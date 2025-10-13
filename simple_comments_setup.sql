-- Simple Comments Database Setup
-- Run these commands one by one in your Supabase SQL editor

-- Step 1: Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    series_id text NOT NULL,
    source text NOT NULL CHECK (source IN ('mf', 'gf', 'mp')),
    chapter_id text,
    parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
    content text NOT NULL,
    user_name text NOT NULL DEFAULT 'User',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    likes_count integer DEFAULT 0 NOT NULL
);

-- Step 2: Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(comment_id, user_id)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_series_source 
ON public.comments(series_id, source);

CREATE INDEX IF NOT EXISTS idx_comments_chapter 
ON public.comments(series_id, source, chapter_id);

CREATE INDEX IF NOT EXISTS idx_comments_user 
ON public.comments(user_id);

-- Step 4: Enable Row Level Security
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Users can view all comments" ON public.comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view all comment likes" ON public.comment_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own likes" ON public.comment_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON public.comment_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Step 6: Grant permissions
GRANT ALL ON public.comments TO authenticated;
GRANT ALL ON public.comment_likes TO authenticated;

-- Step 7: Verify tables exist
SELECT 'Comments table created successfully' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('comments', 'comment_likes');
