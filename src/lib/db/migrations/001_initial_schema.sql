-- Migration: 001_initial_schema.sql
-- Creates all tables for the SOS App

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUM Types
-- =============================================
DO $$ BEGIN
  CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE challenge_frequency AS ENUM ('daily', 'custom');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE challenge_status AS ENUM ('formation', 'active', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE challenge_end_reason AS ENUM ('completed', 'out_of_hearts', 'host_cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('host', 'member');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('invited', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE badge_condition AS ENUM ('challenges_completed', 'streak_days', 'early_adopter');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('challenge_joined', 'challenge_completed', 'friend_added', 'badge_earned', 'checkin_done');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('friend_request', 'friend_accepted', 'challenge_invite', 'challenge_start', 'heart_lost', 'badge_earned', 'nudge');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- Tables
-- =============================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_active BOOLEAN DEFAULT true,
  is_private BOOLEAN DEFAULT false,
  terms_agreed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friend Requests
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friend_request_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_friend_request UNIQUE (sender_id, receiver_id)
);

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration_days INT NOT NULL,
  frequency challenge_frequency NOT NULL DEFAULT 'daily',
  frequency_days JSONB,
  start_at TIMESTAMPTZ,
  reset_time TIME DEFAULT '00:00:00',
  total_hearts INT NOT NULL DEFAULT 3,
  max_members INT NOT NULL DEFAULT 10,
  is_private BOOLEAN DEFAULT false,
  status challenge_status DEFAULT 'formation',
  current_step INT DEFAULT 0,
  hearts_left INT,
  last_processed_cycle INT DEFAULT 0,
  parent_challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
  end_reason challenge_end_reason,
  final_stats JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challenge Members
CREATE TABLE IF NOT EXISTS challenge_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  status member_status NOT NULL DEFAULT 'invited',
  is_ready BOOLEAN DEFAULT false,
  current_step INT DEFAULT 0,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_challenge_member UNIQUE (challenge_id, user_id)
);

-- Check-ins
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_number INT NOT NULL,
  evidence_url TEXT,
  caption TEXT,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  condition_type badge_condition NOT NULL,
  condition_value INT NOT NULL
);

-- User Badges
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id)
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  shown_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_challenge_members_composite ON challenge_members(challenge_id, user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_composite ON checkins(challenge_id, user_id, cycle_number);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
