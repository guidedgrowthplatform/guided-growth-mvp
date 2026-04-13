-- Create storage bucket for voice assets (MP3s from sync script)
-- Per Architecture Doc Section 6.2: public read, service role write
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-assets', 'voice-assets', true, 10485760, ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav'])
ON CONFLICT (id) DO NOTHING;

-- Public read: anyone can play MP3s
DROP POLICY IF EXISTS "Public read voice assets" ON storage.objects;
CREATE POLICY "Public read voice assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-assets');

-- Service role write: sync script uploads MP3s
DROP POLICY IF EXISTS "Service write voice assets" ON storage.objects;
CREATE POLICY "Service write voice assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-assets');
