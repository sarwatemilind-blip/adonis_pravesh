-- Add hierarchy columns to managers table
ALTER TABLE managers
  ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT 'ASM',
  ADD COLUMN IF NOT EXISTS reports_to  TEXT REFERENCES managers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hq          TEXT,
  ADD COLUMN IF NOT EXISTS state       TEXT;
