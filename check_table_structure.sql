-- Check the current structure of recent_reads table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'recent_reads' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check existing constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.recent_reads'::regclass;
