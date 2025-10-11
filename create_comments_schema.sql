-- Comments table for series and chapters
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  series_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('mf', 'gf', 'mp')),
  chapter_id text NULL, -- NULL for series comments, specific for chapter comments
  content text NOT NULL,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE NULL, -- For nested replies
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false
);

-- Comment likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- Indexes for performance
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

-- Row Level Security (RLS) policies
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments
CREATE POLICY "Comments are viewable by everyone" 
ON public.comments FOR SELECT 
USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments" 
ON public.comments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" 
ON public.comments FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" 
ON public.comments FOR DELETE 
USING (auth.uid() = user_id);

-- Anyone can read likes
CREATE POLICY "Likes are viewable by everyone" 
ON public.comment_likes FOR SELECT 
USING (true);

-- Authenticated users can like comments
CREATE POLICY "Authenticated users can like comments" 
ON public.comment_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can unlike comments
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
