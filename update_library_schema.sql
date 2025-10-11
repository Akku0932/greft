-- Add chapter count tracking to library table
-- This will help track when new chapters are actually published vs when series is just added

-- Add column to track last known chapter count
ALTER TABLE public.library 
ADD COLUMN IF NOT EXISTS last_known_chapter_count integer DEFAULT 0;

-- Add column to track when chapters were last checked
ALTER TABLE public.library 
ADD COLUMN IF NOT EXISTS chapters_last_checked_at timestamptz;

-- Create index for faster queries on has_updates
CREATE INDEX IF NOT EXISTS idx_library_has_updates 
ON public.library(user_id, has_updates) 
WHERE has_updates = true;

-- Create index for chapter count queries
CREATE INDEX IF NOT EXISTS idx_library_chapter_tracking 
ON public.library(user_id, last_known_chapter_count, chapters_last_checked_at);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'library' 
AND table_schema = 'public'
AND column_name IN ('last_known_chapter_count', 'chapters_last_checked_at')
ORDER BY column_name;

