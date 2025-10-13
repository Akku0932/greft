-- Safe database migration that handles existing schema properly

-- Step 1: Check current table structure
DO $$ 
DECLARE
    has_source_column boolean;
    has_correct_pk boolean;
BEGIN
    -- Check if source column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recent_reads' 
        AND table_schema = 'public' 
        AND column_name = 'source'
    ) INTO has_source_column;
    
    -- Check if primary key includes source
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'recent_reads_pkey' 
        AND conrelid = 'public.recent_reads'::regclass
        AND pg_get_constraintdef(oid) LIKE '%source%'
    ) INTO has_correct_pk;
    
    -- Add source column if it doesn't exist
    IF NOT has_source_column THEN
        ALTER TABLE public.recent_reads ADD COLUMN source text NOT NULL DEFAULT 'mp';
        RAISE NOTICE 'Added source column to recent_reads table';
    END IF;
    
    -- Update source constraint if needed
    BEGIN
        ALTER TABLE public.recent_reads DROP CONSTRAINT IF EXISTS recent_reads_source_check;
        ALTER TABLE public.recent_reads ADD CONSTRAINT recent_reads_source_check CHECK (source IN ('mf', 'gf', 'mp'));
        RAISE NOTICE 'Updated source constraint for recent_reads table';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Source constraint update failed: %', SQLERRM;
    END;
    
    -- Fix primary key if needed
    IF NOT has_correct_pk THEN
        BEGIN
            ALTER TABLE public.recent_reads DROP CONSTRAINT IF EXISTS recent_reads_pkey;
            ALTER TABLE public.recent_reads ADD CONSTRAINT recent_reads_pkey PRIMARY KEY (user_id, series_id, source);
            RAISE NOTICE 'Updated primary key for recent_reads table';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Primary key update failed: %', SQLERRM;
        END;
    END IF;
END $$;

-- Step 2: Update other tables
-- Update library table to allow 'mp' source
DO $$ 
BEGIN
    ALTER TABLE public.library DROP CONSTRAINT IF EXISTS library_source_check;
    ALTER TABLE public.library ADD CONSTRAINT library_source_check CHECK (source IN ('mf', 'gf', 'mp'));
    RAISE NOTICE 'Updated library source constraint';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Library constraint update failed: %', SQLERRM;
END $$;

-- Update progress table to allow 'mp' source  
DO $$ 
BEGIN
    ALTER TABLE public.progress DROP CONSTRAINT IF EXISTS progress_source_check;
    ALTER TABLE public.progress ADD CONSTRAINT progress_source_check CHECK (source IN ('mf', 'gf', 'mp'));
    RAISE NOTICE 'Updated progress source constraint';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Progress constraint update failed: %', SQLERRM;
END $$;

-- Step 3: Verify final structure
SELECT 'recent_reads table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'recent_reads' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'recent_reads constraints:' as info;
SELECT conname as constraint_name, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.recent_reads'::regclass;
