-- Migration: 002a_add_badge_enum_values.sql
-- Sprint 7: Add missing badge condition enum values
-- Must be applied BEFORE 002_user_stats_badges.sql (separate transaction)

ALTER TYPE badge_condition ADD VALUE IF NOT EXISTS 'checkins_completed';
ALTER TYPE badge_condition ADD VALUE IF NOT EXISTS 'squad_mvp';
