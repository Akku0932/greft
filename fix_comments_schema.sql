-- Fix comments schema with proper foreign key relationships
-- This will safely recreate the tables if they don't exist or fix the relationships

-- Drop existing tables if they exist (this will remove all data!)
-- Uncomment the next two lines if you want to start fresh:
-- DROP TABLE IF EXISTS public.comment_likes CASCADE;
-- DROP TABLE IF EXISTS public.comments CASCADE;

-- Create comments table with proper foreign key
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  series_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('mf', 'gf', 'mp')),
  chapter_id text NULL,
  content text NOT NULL,
  parent_id uuid NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false
);

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- Add foreign key constraints (only if they don't exist)
DO $$ 
BEGIN
    -- Add foreign key to auth.users if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comments_user_id_fkey' 
        AND conrelid = 'public.comments'::regclass
    ) THEN
        ALTER TABLE public.comments 
        ADD CONSTRAINT comments_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add self-referencing foreign key for parent_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comments_parent_id_fkey' 
        AND conrelid = 'public.comments'::regclass
    ) THEN
        ALTER TABLE public.comments 
        ADD CONSTRAINT comments_parent_id_fkey 
        FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for comment_likes
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comment_likes_comment_id_fkey' 
        AND conrelid = 'public.comment_likes'::regclass
    ) THEN
        ALTER TABLE public.comment_likes 
        ADD CONSTRAINT comment_likes_comment_id_fkey 
        FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;
    END IF;

    -- Add foreign key for comment_likes user_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comment_likes_user_id_fkey' 
        AND conrelid = 'public.comment_likes'::regclass
    ) THEN
        ALTER TABLE public.comment_likes 
        ADD CONSTRAINT comment_likes_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_series 
ON public.comments(series_id, source, chapter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_user 
ON public.comments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent 
ON public.comments(parent_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment 
ON public.comment_likes(comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_user 
ON public.comment_likes(user_id);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.comment_likes;
DROP POLICY IF EXISTS "Authenticated users can like comments" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can unlike comments" ON public.comment_likes;

-- Create RLS policies
CREATE POLICY "Comments are viewable by everyone" 
ON public.comments FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create comments" 
ON public.comments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" 
ON public.comments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.comments FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Likes are viewable by everyone" 
ON public.comment_likes FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can like comments" 
ON public.comment_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments" 
ON public.comment_likes FOR DELETE 
USING (auth.uid() = user_id);

-- Create view for comment counts
CREATE OR REPLACE VIEW public.comment_counts AS
SELECT 
  series_id,
  source,
  chapter_id,
  COUNT(*) as count
FROM public.comments
WHERE is_deleted = false
GROUP BY series_id, source, chapter_id;

-- Verify the foreign key relationships
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('comments', 'comment_likes')
ORDER BY tc.table_name, kcu.column_name;
