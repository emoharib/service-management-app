BEGIN;
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS address_building VARCHAR(80),
  ADD COLUMN IF NOT EXISTS address_street VARCHAR(200),
  ADD COLUMN IF NOT EXISTS address_floor VARCHAR(40),
  ADD COLUMN IF NOT EXISTS address_apartment VARCHAR(40),
  ADD COLUMN IF NOT EXISTS school_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS mother_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS father_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS child_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS photo_path TEXT,
  ADD COLUMN IF NOT EXISTS responsible_servant_id UUID REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS followup_status VARCHAR(20) NOT NULL DEFAULT 'not_needed',
  ADD COLUMN IF NOT EXISTS followup_notes TEXT,
  ADD COLUMN IF NOT EXISTS followup_date DATE;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_followup_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_followup_status_check
  CHECK (followup_status IN ('not_needed','pending','contacted','completed'));
CREATE INDEX IF NOT EXISTS idx_children_servant ON children(responsible_servant_id);
COMMIT;
