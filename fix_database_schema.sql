-- Fix database schema to support MP source and correct primary keys

-- 1. Update library table to allow 'mp' source
ALTER TABLE public.library DROP CONSTRAINT IF EXISTS library_source_check;
ALTER TABLE public.library ADD CONSTRAINT library_source_check CHECK (source IN ('mf', 'gf', 'mp'));

-- 2. Update progress table to allow 'mp' source  
ALTER TABLE public.progress DROP CONSTRAINT IF EXISTS progress_source_check;
ALTER TABLE public.progress ADD CONSTRAINT progress_source_check CHECK (source IN ('mf', 'gf', 'mp'));

-- 3. Update recent_reads table to allow 'mp' source
ALTER TABLE public.recent_reads DROP CONSTRAINT IF EXISTS recent_reads_source_check;
ALTER TABLE public.recent_reads ADD CONSTRAINT recent_reads_source_check CHECK (source IN ('mf', 'gf', 'mp'));

-- 4. Fix recent_reads primary key to include source (since same series can exist in different sources)
-- First check if the constraint exists and drop it
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'recent_reads_pkey' 
        AND conrelid = 'public.recent_reads'::regclass
    ) THEN
        ALTER TABLE public.recent_reads DROP CONSTRAINT recent_reads_pkey;
    END IF;
END $$;

-- Add the new primary key constraint
ALTER TABLE public.recent_reads ADD CONSTRAINT recent_reads_pkey PRIMARY KEY (user_id, series_id, source);

-- 5. Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'recent_reads' 
AND table_schema = 'public'
ORDER BY ordinal_position;
