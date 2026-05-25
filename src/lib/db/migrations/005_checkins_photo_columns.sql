-- Ensure deployed checkins tables created from older schemas support photo check-ins.

ALTER TABLE checkins
ADD COLUMN IF NOT EXISTS evidence_url TEXT;

ALTER TABLE checkins
ADD COLUMN IF NOT EXISTS caption TEXT;

ALTER TABLE checkins
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_unique_cycle
ON checkins(challenge_id, user_id, cycle_number);
