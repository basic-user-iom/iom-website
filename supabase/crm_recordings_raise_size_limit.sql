-- Raise screen-recording bucket limit (4+ min at 2.5–4 Mbps exceeds 50–200 MB).
-- Run in Supabase SQL Editor if the API script is not used.

update storage.buckets
set
  file_size_limit = 524288000, -- 500 MB
  allowed_mime_types = array[
    'video/webm',
    'video/mp4',
    'video/quicktime',
    'audio/webm',
    'audio/mpeg',
    'audio/wav',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
where id = 'crm-screen-recordings';
