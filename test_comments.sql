-- Test Comments System
-- Run these queries to debug the comments issue

-- 1. Check if comments table has data
SELECT 
    id, 
    user_id, 
    series_id, 
    source, 
    chapter_id, 
    content, 
    user_name, 
    created_at 
FROM public.comments 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Check RLS policies on comments table
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'comments';

-- 3. Check if user can see their own comments
-- (Replace 'your-user-id' with your actual user ID from auth.users)
SELECT 
    id, 
    content, 
    user_name, 
    created_at 
FROM public.comments 
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC;

-- 4. Check table permissions
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.table_privileges 
WHERE table_name = 'comments' 
AND table_schema = 'public';
