import { Pool } from 'pg';
import * as crypto from 'crypto';

async function seed() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DIRECT_URL or DATABASE_URL must be set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Seeding test data...');

    // Check if seed data already exists
    const { rows: existingUsers } = await pool.query(
      "SELECT id FROM users WHERE email = 'alice@example.com'"
    );
    if (existingUsers.length > 0) {
      console.log('⏭  Seed data already exists, skipping.');
      return;
    }

    // We'll use bcrypt-compatible hashes. For seed, use a pre-hashed "Password123!"
    // bcrypt hash of "Password123!" with cost 12
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('Password123!', 12);

    // Create test users
    const { rows: [alice] } = await pool.query(
      `INSERT INTO users (email, password_hash, username, display_name, bio, terms_agreed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      ['alice@example.com', passwordHash, 'alice', 'Alice Nguyen', 'I love challenges!']
    );

    const { rows: [bob] } = await pool.query(
      `INSERT INTO users (email, password_hash, username, display_name, bio, terms_agreed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      ['bob@example.com', passwordHash, 'bob_the_builder', 'Bob Tran', 'Building habits one day at a time']
    );

    const { rows: [charlie] } = await pool.query(
      `INSERT INTO users (email, password_hash, username, display_name, bio, terms_agreed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      ['charlie@example.com', passwordHash, 'charlie99', 'Charlie Le', 'Early bird gets the worm']
    );

    console.log(`✅ Created users: alice(${alice.id}), bob(${bob.id}), charlie(${charlie.id})`);

    // Create friend requests
    await pool.query(
      `INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'accepted')`,
      [alice.id, bob.id]
    );
    await pool.query(
      `INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'pending')`,
      [charlie.id, alice.id]
    );
    console.log('✅ Created friend requests');

    // Create a challenge
    const { rows: [challenge] } = await pool.query(
      `INSERT INTO challenges (title, description, creator_id, duration_days, frequency, reset_time, total_hearts, max_members, status, hearts_left, start_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING id`,
      ['Wake Up at 6AM', '30 days of waking up early!', alice.id, 30, 'daily', '06:00:00', 3, 10, 'active', 3]
    );
    console.log(`✅ Created challenge: ${challenge.id}`);

    // Add members to challenge
    await pool.query(
      `INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, joined_at)
       VALUES ($1, $2, 'host', 'accepted', true, NOW())`,
      [challenge.id, alice.id]
    );
    await pool.query(
      `INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, joined_at)
       VALUES ($1, $2, 'member', 'accepted', true, NOW())`,
      [challenge.id, bob.id]
    );
    await pool.query(
      `INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, joined_at)
       VALUES ($1, $2, 'member', 'invited', false, NULL)`,
      [challenge.id, charlie.id]
    );
    console.log('✅ Added challenge members');

    // Create checkins
    await pool.query(
      `INSERT INTO checkins (challenge_id, user_id, cycle_number, caption, checked_in_at)
       VALUES ($1, $2, 1, 'Day 1 done!', NOW())`,
      [challenge.id, alice.id]
    );
    await pool.query(
      `INSERT INTO checkins (challenge_id, user_id, cycle_number, caption, checked_in_at)
       VALUES ($1, $2, 1, 'Barely made it!', NOW())`,
      [challenge.id, bob.id]
    );
    console.log('✅ Created checkins');

    // Create badges
    const { rows: [badge] } = await pool.query(
      `INSERT INTO badges (name, description, icon_url, condition_type, condition_value)
       VALUES ('First Challenge', 'Completed your first challenge', '/badges/first.png', 'challenges_completed', 1)
       RETURNING id`
    );
    await pool.query(
      `INSERT INTO badges (name, description, icon_url, condition_type, condition_value)
       VALUES ('7-Day Streak', 'Maintained a 7-day streak', '/badges/streak7.png', 'streak_days', 7)`
    );
    console.log('✅ Created badges');

    // Create notifications
    await pool.query(
      `INSERT INTO notifications (user_id, type, metadata, is_read)
       VALUES ($1, 'challenge_invite', $2, false)`,
      [charlie.id, JSON.stringify({ challengeId: challenge.id, invitedBy: alice.id })]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, type, metadata, is_read)
       VALUES ($1, 'friend_request', $2, false)`,
      [alice.id, JSON.stringify({ fromUserId: charlie.id, fromUsername: 'charlie99' })]
    );
    console.log('✅ Created notifications');

    // Create activities
    await pool.query(
      `INSERT INTO activities (user_id, type, metadata)
       VALUES ($1, 'challenge_joined', $2)`,
      [alice.id, JSON.stringify({ challengeId: challenge.id, title: 'Wake Up at 6AM' })]
    );
    await pool.query(
      `INSERT INTO activities (user_id, type, metadata)
       VALUES ($1, 'checkin_done', $2)`,
      [alice.id, JSON.stringify({ challengeId: challenge.id, cycleNumber: 1 })]
    );
    console.log('✅ Created activities');

    console.log('\n🎉 Seed complete! Test credentials:');
    console.log('   Email: alice@example.com / bob@example.com / charlie@example.com');
    console.log('   Password: Password123!');

  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
