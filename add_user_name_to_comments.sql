-- Add user_name column to comments table to store display name
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS user_name text;

-- Update existing comments with user names from profiles
UPDATE public.comments 
SET user_name = COALESCE(
  (SELECT display_name FROM public.profiles WHERE profiles.id = comments.user_id),
  'User'
)
WHERE user_name IS NULL;

-- Make user_name NOT NULL for new comments
ALTER TABLE public.comments 
ALTER COLUMN user_name SET NOT NULL;

-- Add default value for future inserts
ALTER TABLE public.comments 
ALTER COLUMN user_name SET DEFAULT 'User';
