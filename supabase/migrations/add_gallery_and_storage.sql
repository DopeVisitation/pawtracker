-- ============================================================
-- Gallery Photos Table
-- ============================================================
CREATE TABLE IF NOT EXISTS gallery_photos (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  uploaded_by  UUID        NOT NULL REFERENCES profiles(id),
  photo_url    TEXT        NOT NULL,
  caption      TEXT,
  hashtags     TEXT[]      NOT NULL DEFAULT '{}',
  cat_ids      UUID[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_household_access" ON gallery_photos
  FOR ALL USING (
    household_id IN (
      SELECT household_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- Photos Storage Bucket
-- Run this in the Supabase SQL Editor (Storage section)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'photos_upload_policy'
  ) THEN
    CREATE POLICY "photos_upload_policy" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'photos');
  END IF;
END $$;

-- Allow public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'photos_read_policy'
  ) THEN
    CREATE POLICY "photos_read_policy" ON storage.objects
      FOR SELECT USING (bucket_id = 'photos');
  END IF;
END $$;

-- Allow authenticated users to delete their own photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'photos_delete_policy'
  ) THEN
    CREATE POLICY "photos_delete_policy" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'photos');
  END IF;
END $$;
