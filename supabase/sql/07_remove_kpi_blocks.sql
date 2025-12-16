-- Migration: Remove KPI blocks from module_sections
-- This migration strips any blocks with type "kpis" or "kpi-strip" from the JSONB blocks array.
-- The application code already ignores these block types, but this cleans up the database.

-- Update module_sections to remove KPI blocks from the blocks array
UPDATE module_sections
SET blocks = (
  SELECT COALESCE(jsonb_agg(block), '[]'::jsonb)
  FROM jsonb_array_elements(blocks) AS block
  WHERE block->>'type' NOT IN ('kpis', 'kpi-strip')
)
WHERE blocks IS NOT NULL
  AND blocks != '[]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(blocks) AS block
    WHERE block->>'type' IN ('kpis', 'kpi-strip')
  );

-- Also clean up any KPI blocks in the audit table (module_section_audit)
-- The old_blocks and new_blocks columns contain historical snapshots
-- We leave these as-is for historical accuracy, but the app will ignore them when parsing.

-- Verify no KPI blocks remain in active content
DO $$
DECLARE
  kpi_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO kpi_count
  FROM module_sections, jsonb_array_elements(blocks) AS block
  WHERE block->>'type' IN ('kpis', 'kpi-strip');
  
  IF kpi_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % KPI blocks still exist', kpi_count;
  END IF;
  
  RAISE NOTICE 'Migration complete: No KPI blocks remain in module_sections';
END $$;

