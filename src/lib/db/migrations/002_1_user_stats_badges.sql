-- Migration: 002_user_stats_badges.sql
-- Sprint 7: User Stats table + Seed badges catalog
-- NOTE: Enum values (checkins_completed, squad_mvp) added in 002a migration

-- =============================================
-- User Stats table (aggregated metrics)
-- =============================================
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  challenges_joined INT NOT NULL DEFAULT 0,
  challenges_completed INT NOT NULL DEFAULT 0,
  total_checkins INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Add slug column to badges if not exists
-- =============================================
DO $$ BEGIN
  ALTER TABLE badges ADD COLUMN slug TEXT UNIQUE;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- =============================================
-- Seed badges catalog (idempotent — skip if slug exists)
-- =============================================
INSERT INTO badges (name, slug, description, icon_url, condition_type, condition_value)
VALUES
  ('Early Adopter', 'early-adopter', 'Joined during the beta period', '/badges/early-adopter.png', 'early_adopter', 1),
  ('First Check-in', 'first-checkin', 'Completed your first check-in', '/badges/first-checkin.png', 'checkins_completed', 1),
  ('Week Warrior', 'streak-7', 'Maintained a 7-day streak', '/badges/streak-7.png', 'streak_days', 7),
  ('Monthly Master', 'streak-30', 'Maintained a 30-day streak', '/badges/streak-30.png', 'streak_days', 30),
  ('Streak Legend', 'streak-100', 'Maintained a 100-day streak', '/badges/streak-100.png', 'streak_days', 100),
  ('Challenge Starter', 'challenge-1', 'Completed your first challenge', '/badges/challenge-1.png', 'challenges_completed', 1),
  ('Challenge Veteran', 'challenge-5', 'Completed 5 challenges', '/badges/challenge-5.png', 'challenges_completed', 5),
  ('Challenge Master', 'challenge-10', 'Completed 10 challenges', '/badges/challenge-10.png', 'challenges_completed', 10),
  ('Squad MVP', 'squad-mvp', '100% completion rate in a challenge', '/badges/squad-mvp.png', 'squad_mvp', 1)
ON CONFLICT (slug) DO NOTHING;

-- Update existing badges that were seeded without slug
UPDATE badges SET slug = 'challenge-1-old' WHERE name = 'First Challenge' AND slug IS NULL;
UPDATE badges SET slug = 'streak-7-old' WHERE name = '7-Day Streak' AND slug IS NULL;
UPDATE badges SET slug = 'early-adopter-old' WHERE name = 'Early Adopter' AND slug IS NULL;
