-- Migration: Add file tracking columns to content_chunks table
-- Run this in Supabase SQL Editor if you already have the table created

-- Add file tracking columns (safe to run multiple times)
ALTER TABLE public.content_chunks 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Create storage bucket for syllabus files
-- Note: This requires storage admin privileges
-- If this fails, create the bucket manually in Supabase Dashboard → Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('syllabus-files', 'syllabus-files', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies (optional - adjust based on your security needs)
-- Allow authenticated users to upload (if you add auth later)
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'syllabus-files');

-- Allow service role to manage files (for server-side uploads)
-- This is already enabled by default for service role

