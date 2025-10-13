-- Temporarily disable RLS for testing
-- This will allow all users to see all comments

-- Disable RLS on comments table
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;

-- Disable RLS on comment_likes table  
ALTER TABLE public.comment_likes DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename IN ('comments', 'comment_likes') 
AND schemaname = 'public';

SELECT 'RLS disabled - comments should now be visible to all users' as status;
