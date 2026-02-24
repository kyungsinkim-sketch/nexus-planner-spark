/// Re-Be.io Local RAG Engine
///
/// Privacy-first knowledge management:
/// - SQLite for structured storage
/// - ONNX all-MiniLM-L6-v2 for 384-dim embeddings (offline)
/// - Hybrid search (vector similarity + relevance + usage)
/// - Dialectic search for 정반합 (thesis-antithesis-synthesis)
/// - Claude Haiku chat digest analysis
/// - Knowledge extraction pipeline (digest → ingest → embed → store)
/// - CEO 30-pattern initial seeding

pub mod db;
pub mod embedding;
pub mod query;
pub mod knowledge;
pub mod digest;
pub mod ingest;
pub mod seed;
