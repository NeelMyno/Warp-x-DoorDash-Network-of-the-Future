-- Migration: Clean up legacy two-column and timeline blocks
-- This migration removes timeline blocks and old two-column content,
-- forcing the app to fall back to the clean single-column config.

-- Step 1: Remove timeline blocks from module_sections (similar to KPI migration)
UPDATE module_sections
SET blocks = (
  SELECT COALESCE(jsonb_agg(block), '[]'::jsonb)
  FROM jsonb_array_elements(blocks) AS block
  WHERE block->>'type' NOT IN ('timeline')
)
WHERE blocks IS NOT NULL
  AND blocks != '[]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(blocks) AS block
    WHERE block->>'type' IN ('timeline')
  );

-- Step 2: For sections that now have only empty blocks arrays, delete them
-- This allows the app to fall back to config-based content
DELETE FROM module_sections
WHERE blocks = '[]'::jsonb;

-- Step 3: For sections that still have old placeholder content with 
-- "What success looks like" or "Milestones" titles, clear them
-- to force fallback to the clean config content
UPDATE module_sections
SET blocks = '[]'::jsonb
WHERE blocks IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(blocks) AS block
    WHERE block->>'title' IN (
      'What success looks like',
      'Milestones', 
      'Validated so far',
      'Cadence',
      'Planned steps',
      'Timeline'
    )
  );

-- Step 4: Delete now-empty sections
DELETE FROM module_sections
WHERE blocks = '[]'::jsonb;

-- Verify no legacy blocks remain
DO $$
DECLARE
  timeline_count INTEGER;
  legacy_title_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO timeline_count
  FROM module_sections, jsonb_array_elements(blocks) AS block
  WHERE block->>'type' = 'timeline';
  
  SELECT COUNT(*)
  INTO legacy_title_count
  FROM module_sections, jsonb_array_elements(blocks) AS block
  WHERE block->>'title' IN (
    'What success looks like',
    'Milestones', 
    'Validated so far',
    'Cadence',
    'Planned steps',
    'Timeline'
  );
  
  IF timeline_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % timeline blocks still exist', timeline_count;
  END IF;
  
  IF legacy_title_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % legacy titled blocks still exist', legacy_title_count;
  END IF;
  
  RAISE NOTICE 'Migration complete: All legacy blocks have been cleaned up';
END $$;

