-- Rollback: 001_initial_schema.sql
-- Drops all tables and types

DROP TABLE IF EXISTS refresh_tokens
CASCADE;
DROP TABLE IF EXISTS notifications
CASCADE;
DROP TABLE IF EXISTS activities
CASCADE;
DROP TABLE IF EXISTS user_badges
CASCADE;
DROP TABLE IF EXISTS badges
CASCADE;
DROP TABLE IF EXISTS checkins
CASCADE;
DROP TABLE IF EXISTS challenge_members
CASCADE;
DROP TABLE IF EXISTS challenges
CASCADE;
DROP TABLE IF EXISTS friend_requests
CASCADE;
DROP TABLE IF EXISTS users
CASCADE;

DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS activity_type;
DROP TYPE IF EXISTS badge_condition;
DROP TYPE IF EXISTS member_status;
DROP TYPE IF EXISTS member_role;
DROP TYPE IF EXISTS challenge_end_reason;
DROP TYPE IF EXISTS challenge_status;
DROP TYPE IF EXISTS challenge_frequency;
DROP TYPE IF EXISTS friend_request_status;
