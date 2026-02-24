/// Embedding Engine for Local RAG
///
/// Supports two modes:
/// 1. ONNX: all-MiniLM-L6-v2 (384-dim, ~22MB INT8) — production quality
/// 2. Pseudo: deterministic hash-based vectors — fallback when model unavailable
///
/// Model files expected at:
///   <app_data_dir>/models/all-MiniLM-L6-v2/model.onnx
///   <app_data_dir>/models/all-MiniLM-L6-v2/tokenizer.json

use std::path::PathBuf;
use std::sync::Mutex;

/// Embedding dimension for all-MiniLM-L6-v2
pub const EMBEDDING_DIM: usize = 384;

/// Embedding engine state
pub struct EmbeddingEngine {
    model_dir: PathBuf,
    onnx_session: Mutex<Option<OnnxSession>>,
}

/// Holds the loaded ONNX session + tokenizer
struct OnnxSession {
    session: ort::session::Session,
    tokenizer: tokenizers::Tokenizer,
}

/// Result of embedding a text
#[derive(Debug, Clone)]
pub struct EmbeddingResult {
    pub vector: Vec<f32>,
    pub is_pseudo: bool,
}

impl EmbeddingEngine {
    pub fn new(model_dir: PathBuf) -> Self {
        Self {
            model_dir,
            onnx_session: Mutex::new(None),
        }
    }

    /// Check if the ONNX model files exist on disk.
    pub fn is_model_available(&self) -> bool {
        let model_path = self.model_dir.join("model.onnx");
        let tokenizer_path = self.model_dir.join("tokenizer.json");
        model_path.exists() && tokenizer_path.exists()
    }

    /// Lazy-load the ONNX session + tokenizer.
    fn ensure_onnx_loaded(&self) -> Result<(), String> {
        let mut guard = self.onnx_session.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Ok(());
        }

        let model_path = self.model_dir.join("model.onnx");
        let tokenizer_path = self.model_dir.join("tokenizer.json");

        if !model_path.exists() || !tokenizer_path.exists() {
            return Err("ONNX model files not found".to_string());
        }

        log::info!("Loading ONNX model from {:?}", model_path);

        // Load tokenizer
        let tokenizer = tokenizers::Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| format!("Failed to load tokenizer: {}", e))?;

        // Create ONNX session
        let session = ort::session::Session::builder()
            .map_err(|e| format!("Failed to create session builder: {}", e))?
            .with_intra_threads(2)
            .map_err(|e| format!("Failed to set threads: {}", e))?
            .with_optimization_level(ort::session::builder::GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Failed to set opt level: {}", e))?
            .commit_from_file(&model_path)
            .map_err(|e| format!("Failed to load ONNX model: {}", e))?;

        log::info!("ONNX model loaded successfully (384-dim)");

        *guard = Some(OnnxSession { session, tokenizer });
        Ok(())
    }

    /// Generate embedding for a text string.
    /// Falls back to pseudo-embedding if ONNX model is not available.
    pub fn embed(&self, text: &str) -> Result<EmbeddingResult, String> {
        if self.is_model_available() {
            match self.embed_onnx(text) {
                Ok(result) => return Ok(result),
                Err(e) => {
                    log::warn!("ONNX embedding failed, falling back to pseudo: {}", e);
                }
            }
        }
        Ok(self.pseudo_embed(text))
    }

    /// Generate embedding using ONNX Runtime.
    fn embed_onnx(&self, text: &str) -> Result<EmbeddingResult, String> {
        self.ensure_onnx_loaded()?;

        let mut guard = self.onnx_session.lock().map_err(|e| e.to_string())?;
        let session = guard.as_mut().ok_or("ONNX session not loaded")?;

        // Tokenize
        let encoding = session.tokenizer
            .encode(text, true)
            .map_err(|e| format!("Tokenization failed: {}", e))?;

        let input_ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
        let attention_mask: Vec<i64> = encoding.get_attention_mask().iter().map(|&m| m as i64).collect();
        let token_type_ids: Vec<i64> = encoding.get_type_ids().iter().map(|&t| t as i64).collect();

        let seq_len = input_ids.len();
        let shape = vec![1i64, seq_len as i64];

        // Create Tensor inputs using ort::value::Tensor
        let input_ids_tensor = ort::value::Tensor::from_array((shape.clone(), input_ids))
            .map_err(|e| format!("input_ids tensor error: {}", e))?;
        let attention_mask_tensor = ort::value::Tensor::from_array((shape.clone(), attention_mask.clone()))
            .map_err(|e| format!("attention_mask tensor error: {}", e))?;
        let token_type_ids_tensor = ort::value::Tensor::from_array((shape, token_type_ids))
            .map_err(|e| format!("token_type_ids tensor error: {}", e))?;

        // Run inference
        let outputs = session.session.run(
            ort::inputs![
                "input_ids" => input_ids_tensor,
                "attention_mask" => attention_mask_tensor,
                "token_type_ids" => token_type_ids_tensor,
            ]
        ).map_err(|e| format!("ONNX inference failed: {}", e))?;

        // Extract output: [1, seq_len, 384] → mean pooling → [384]
        // try_extract_tensor returns (&Shape, &[f32]) — flat slice with shape info
        let (output_shape, output_data) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Output extraction failed: {}", e))?;

        // output_shape = [1, seq_len, 384], output_data = flat &[f32]
        let dim = if output_shape.len() == 3 { output_shape[2] as usize } else { EMBEDDING_DIM };

        // Mean pooling with attention mask
        let mut pooled = vec![0.0f32; EMBEDDING_DIM];
        let mut total_weight = 0.0f32;

        for t in 0..seq_len {
            let weight = attention_mask[t] as f32;
            total_weight += weight;
            for d in 0..EMBEDDING_DIM.min(dim) {
                // Flat index: batch(0) * seq_len * dim + t * dim + d
                pooled[d] += output_data[t * dim + d] * weight;
            }
        }

        if total_weight > 0.0 {
            for v in pooled.iter_mut() {
                *v /= total_weight;
            }
        }

        // L2 normalize
        let norm: f32 = pooled.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for v in pooled.iter_mut() {
                *v /= norm;
            }
        }

        Ok(EmbeddingResult {
            vector: pooled,
            is_pseudo: false,
        })
    }

    /// Deterministic pseudo-embedding for development/testing.
    /// Mirrors the server's fallback algorithm from rag-client.ts.
    pub fn pseudo_embed(&self, text: &str) -> EmbeddingResult {
        let mut vector = vec![0.0f32; EMBEDDING_DIM];
        let chars: Vec<char> = text.chars().take(500).collect();

        for (i, &ch) in chars.iter().enumerate() {
            let code = ch as u32;
            for d in 0..EMBEDDING_DIM {
                let idx = ((code.wrapping_mul(31).wrapping_add(i as u32 * 17).wrapping_add(d as u32 * 37)) & 0x7fffffff) as usize % EMBEDDING_DIM;
                let val = ((code as f32) * ((d + 1) as f32) * 0.1).sin() * 0.1;
                vector[idx] += val;
            }
        }

        let norm: f32 = vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for v in vector.iter_mut() {
                *v /= norm;
            }
        }

        EmbeddingResult {
            vector,
            is_pseudo: true,
        }
    }
}

/// Compute cosine similarity between two vectors.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have same dimension");

    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot / (norm_a * norm_b)
}

/// Serialize embedding vector to bytes (for SQLite BLOB storage).
pub fn vector_to_blob(vector: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(vector.len() * 4);
    for &v in vector {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    bytes
}

/// Deserialize embedding vector from bytes (from SQLite BLOB).
pub fn blob_to_vector(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pseudo_embed_deterministic() {
        let engine = EmbeddingEngine::new(PathBuf::from("/tmp/test"));
        let r1 = engine.pseudo_embed("hello world");
        let r2 = engine.pseudo_embed("hello world");
        assert_eq!(r1.vector, r2.vector);
        assert!(r1.is_pseudo);
    }

    #[test]
    fn test_pseudo_embed_different_texts() {
        let engine = EmbeddingEngine::new(PathBuf::from("/tmp/test"));
        let r1 = engine.pseudo_embed("예산 관련 의사결정");
        let r2 = engine.pseudo_embed("크리에이티브 방향성 결정");
        let sim = cosine_similarity(&r1.vector, &r2.vector);
        assert!(sim < 1.0 && sim > -0.5, "sim = {}", sim);
    }

    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-6);

        let c = vec![0.0, 1.0, 0.0];
        assert!((cosine_similarity(&a, &c)).abs() < 1e-6);
    }

    #[test]
    fn test_blob_roundtrip() {
        let v = vec![1.0f32, -2.5, 3.14, 0.0];
        let blob = vector_to_blob(&v);
        let recovered = blob_to_vector(&blob);
        assert_eq!(v, recovered);
    }

    #[test]
    fn test_embedding_dimension() {
        let engine = EmbeddingEngine::new(PathBuf::from("/tmp/test"));
        let result = engine.pseudo_embed("test");
        assert_eq!(result.vector.len(), EMBEDDING_DIM);
    }
}
