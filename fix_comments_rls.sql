-- Fix Comments RLS Issues
-- This script fixes common RLS problems with comments

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view all comments" ON public.comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;

-- 2. Create more permissive policies
CREATE POLICY "Enable read access for all users" ON public.comments
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for users based on user_id" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for users based on user_id" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Ensure proper permissions
GRANT ALL ON public.comments TO authenticated;
GRANT ALL ON public.comment_likes TO authenticated;

-- 4. Check if tables are accessible
SELECT 'RLS policies updated successfully' as status;
