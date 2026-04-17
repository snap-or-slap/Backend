-- Migration: 004_sprint9_history_recreate.sql
-- Sprint 9: History, Recreate & Milestone support

-- Add streak_milestone to notification_type enum (safe — IF NOT EXISTS)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'streak_milestone';

-- Add streak_milestone to activity_type enum (safe — IF NOT EXISTS)
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'streak_milestone';

-- Add ended_at column to challenges (idempotent via IF NOT EXISTS on index)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Index for user's finished challenges lookup (history list)
CREATE INDEX IF NOT EXISTS idx_challenge_members_user_status
  ON challenge_members(user_id, status);

-- Index for challenges by status + ended_at (history sorting)
CREATE INDEX IF NOT EXISTS idx_challenges_status_ended
  ON challenges(status, ended_at DESC)
  WHERE status IN ('completed', 'failed', 'cancelled');

-- Index for parent_challenge_id lookups (recreate tracking)
CREATE INDEX IF NOT EXISTS idx_challenges_parent
  ON challenges(parent_challenge_id)
  WHERE parent_challenge_id IS NOT NULL;
