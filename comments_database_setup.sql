-- Comments System Database Setup
-- This file sets up the complete comments system with all necessary tables and relationships

-- 1. Create comments table
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

-- 2. Create comment_likes table for tracking likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(comment_id, user_id)
);

-- 3. Add user_name column to comments table (if not exists)
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS user_name text;

-- 4. Update existing comments with user names from profiles
UPDATE public.comments 
SET user_name = COALESCE(
  (SELECT display_name FROM public.profiles WHERE profiles.id = comments.user_id),
  'User'
)
WHERE user_name IS NULL;

-- 5. Make user_name NOT NULL for new comments
ALTER TABLE public.comments 
ALTER COLUMN user_name SET NOT NULL;

-- 6. Add default value for future inserts
ALTER TABLE public.comments 
ALTER COLUMN user_name SET DEFAULT 'User';

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_series_source 
ON public.comments(series_id, source);

CREATE INDEX IF NOT EXISTS idx_comments_chapter 
ON public.comments(series_id, source, chapter_id);

CREATE INDEX IF NOT EXISTS idx_comments_user 
ON public.comments(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_created_at 
ON public.comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment 
ON public.comment_likes(comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_user 
ON public.comment_likes(user_id);

-- 8. Create function to update likes_count automatically
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.comments 
        SET likes_count = likes_count + 1 
        WHERE id = NEW.comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.comments 
        SET likes_count = GREATEST(likes_count - 1, 0) 
        WHERE id = OLD.comment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to automatically update likes_count
DROP TRIGGER IF EXISTS trigger_update_comment_likes_count ON public.comment_likes;
CREATE TRIGGER trigger_update_comment_likes_count
    AFTER INSERT OR DELETE ON public.comment_likes
    FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- 10. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_comments_updated_at ON public.comments;
CREATE TRIGGER trigger_update_comments_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Set up Row Level Security (RLS)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS policies for comments
CREATE POLICY "Users can view all comments" ON public.comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- 14. Create RLS policies for comment_likes
CREATE POLICY "Users can view all comment likes" ON public.comment_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own likes" ON public.comment_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON public.comment_likes
    FOR DELETE USING (auth.uid() = user_id);

-- 15. Grant necessary permissions
GRANT ALL ON public.comments TO authenticated;
GRANT ALL ON public.comment_likes TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 16. Verify the setup
SELECT 'Comments table created successfully' as status;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'comments' 
AND table_schema = 'public'
ORDER BY ordinal_position;
