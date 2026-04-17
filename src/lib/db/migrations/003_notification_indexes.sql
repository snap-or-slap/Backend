-- Migration: 003_notification_indexes.sql
-- Sprint 8: Improve notification query performance

-- Composite index for notification listing (user + read status + time ordering)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications(user_id, is_read, created_at DESC);

-- Index for sync endpoint (pending overlays: shown_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_notifications_user_shown
  ON notifications(user_id, shown_at)
  WHERE shown_at IS NULL;
