-- Migration 045: Create voice-recordings storage bucket
--
-- Storage bucket for audio files (recordings + uploads).
-- Public access so client can play audio via URL.
-- 50MB file size limit, audio MIME types only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-recordings',
  'voice-recordings',
  true,
  52428800,  -- 50MB
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own voice recordings" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'voice-recordings'
    AND (select auth.role()) = 'authenticated'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Public read access (for audio playback)
CREATE POLICY "Public can read voice recordings" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-recordings');

-- Users can delete their own recordings
CREATE POLICY "Users can delete own voice recordings" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'voice-recordings'
    AND (select auth.role()) = 'authenticated'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
