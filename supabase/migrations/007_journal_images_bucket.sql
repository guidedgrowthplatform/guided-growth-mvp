-- Create storage bucket for journal images
-- Uploads go through API with service role (bypasses RLS)
-- Public reads for displaying images
INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-images', 'journal-images', true)
ON CONFLICT (id) DO NOTHING;
