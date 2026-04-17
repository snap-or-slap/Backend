import { Pool } from 'pg';

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

		const bcrypt = require('bcrypt');
		const passwordHash = await bcrypt.hash('Password123!', 12);

		// =============================================
		// 1. Create 5 test users
		// =============================================
		const { rows: [alice] } = await pool.query(
			`INSERT INTO users (email, password_hash, username, display_name, bio, is_private, terms_agreed_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
			['alice@example.com', passwordHash, 'alice', 'Alice Nguyen', 'I love challenges! 🏃‍♀️', false]
		);
		const { rows: [bob] } = await pool.query(
			`INSERT INTO users (email, password_hash, username, display_name, bio, is_private, terms_agreed_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
			['bob@example.com', passwordHash, 'bob_the_builder', 'Bob Tran', 'Building habits one day at a time 💪', false]
		);
		const { rows: [charlie] } = await pool.query(
			`INSERT INTO users (email, password_hash, username, display_name, bio, is_private, terms_agreed_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
			['charlie@example.com', passwordHash, 'charlie99', 'Charlie Le', 'Early bird gets the worm 🐛', false]
		);
		const { rows: [diana] } = await pool.query(
			`INSERT INTO users (email, password_hash, username, display_name, bio, is_private, terms_agreed_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
			['diana@example.com', passwordHash, 'diana_fit', 'Diana Pham', 'Fitness enthusiast 🏋️', true]
		);
		const { rows: [edward] } = await pool.query(
			`INSERT INTO users (email, password_hash, username, display_name, bio, is_private, terms_agreed_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
			['edward@example.com', passwordHash, 'edward_dev', 'Edward Vo', 'Code + Coffee = Ship 🚀', false]
		);
		console.log(`✅ Created 5 users: alice(${alice.id}), bob(${bob.id}), charlie(${charlie.id}), diana(${diana.id}), edward(${edward.id})`);

		// =============================================
		// 2. Friend requests (various states)
		// =============================================
		await pool.query(
			`INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'accepted')`,
			[alice.id, bob.id]
		);
		await pool.query(
			`INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'accepted')`,
			[alice.id, charlie.id]
		);
		await pool.query(
			`INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'accepted')`,
			[bob.id, charlie.id]
		);
		await pool.query(
			`INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'pending')`,
			[diana.id, alice.id]
		);
		await pool.query(
			`INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'pending')`,
			[edward.id, bob.id]
		);
		await pool.query(
			`INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES ($1, $2, 'declined')`,
			[edward.id, charlie.id]
		);
		console.log('✅ Created friend requests (3 accepted, 2 pending, 1 declined)');

		// =============================================
		// 3. Challenges (various statuses)
		// =============================================
		// Challenge 1: Active — "Wake Up at 6AM"
		const { rows: [ch1] } = await pool.query(
			`INSERT INTO challenges (title, description, creator_id, duration_days, frequency, reset_time, total_hearts, hearts_left, max_members, status, start_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, 'active', NOW() - INTERVAL '3 days')
			 RETURNING id`,
			['Wake Up at 6AM', '30 days of waking up early! Snap a photo of your alarm clock.', alice.id, 30, 'daily', '06:00:00', 3, 10]
		);
		// Challenge 2: Formation — "Read 20 Pages Daily"
		const { rows: [ch2] } = await pool.query(
			`INSERT INTO challenges (title, description, creator_id, duration_days, frequency, reset_time, total_hearts, hearts_left, max_members, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, 'formation')
			 RETURNING id`,
			['Read 20 Pages Daily', 'Read at least 20 pages every day for 14 days. Snap your book!', bob.id, 14, 'daily', '22:00:00', 2, 5]
		);
		// Challenge 3: Completed — "7-Day No Sugar"
		const { rows: [ch3] } = await pool.query(
			`INSERT INTO challenges (title, description, creator_id, duration_days, frequency, reset_time, total_hearts, hearts_left, max_members, status, start_at, end_reason, final_stats)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', NOW() - INTERVAL '10 days', 'completed', $10)
			 RETURNING id`,
			['7-Day No Sugar', 'Avoid sugar for a full week. Stay strong!', charlie.id, 7, 'daily', '00:00:00', 3, 1, 10, JSON.stringify({ totalCheckins: 14, avgCompletion: 0.85 })]
		);
		console.log(`✅ Created 3 challenges: active(${ch1.id}), formation(${ch2.id}), completed(${ch3.id})`);

		// =============================================
		// 4. Challenge members
		// =============================================
		// Ch1 members: alice (host), bob, charlie
		await pool.query(
			`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, current_step, joined_at)
			 VALUES ($1, $2, 'host', 'accepted', true, 3, NOW() - INTERVAL '3 days')`,
			[ch1.id, alice.id]
		);
		await pool.query(
			`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, current_step, joined_at)
			 VALUES ($1, $2, 'member', 'accepted', true, 2, NOW() - INTERVAL '3 days')`,
			[ch1.id, bob.id]
		);
		await pool.query(
			`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, current_step, joined_at)
			 VALUES ($1, $2, 'member', 'invited', false, 0, NULL)`,
			[ch1.id, charlie.id]
		);

		// Ch2 members: bob (host), alice (invited)
		await pool.query(
			`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, joined_at)
			 VALUES ($1, $2, 'host', 'accepted', true, NOW())`,
			[ch2.id, bob.id]
		);
		await pool.query(
			`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, joined_at)
			 VALUES ($1, $2, 'member', 'invited', false, NULL)`,
			[ch2.id, alice.id]
		);

		// Ch3 members: charlie (host), alice, bob — all accepted (completed challenge)
		await pool.query(
			`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, current_step, joined_at)
			 VALUES ($1, $2, 'host', 'accepted', true, 7, NOW() - INTERVAL '10 days')`,
			[ch3.id, charlie.id]
		);
		await pool.query(
			`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, current_step, joined_at)
			 VALUES ($1, $2, 'member', 'accepted', true, 7, NOW() - INTERVAL '10 days')`,
			[ch3.id, alice.id]
		);
		await pool.query(
			`INSERT INTO challenge_members (challenge_id, user_id, role, status, is_ready, current_step, joined_at)
			 VALUES ($1, $2, 'member', 'accepted', true, 6, NOW() - INTERVAL '10 days')`,
			[ch3.id, bob.id]
		);
		console.log('✅ Added challenge members');

		// =============================================
		// 5. Checkins (for active + completed challenges)
		// =============================================
		// Ch1 checkins — Day 1, 2, 3
		for (let day = 1; day <= 3; day++) {
			await pool.query(
				`INSERT INTO checkins (challenge_id, user_id, cycle_number, caption, checked_in_at)
				 VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${3 - day} days')`,
				[ch1.id, alice.id, day, `Day ${day} — alarm proof! ⏰`]
			);
		}
		for (let day = 1; day <= 2; day++) {
			await pool.query(
				`INSERT INTO checkins (challenge_id, user_id, cycle_number, caption, checked_in_at)
				 VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${2 - day} days')`,
				[ch1.id, bob.id, day, `Day ${day} — barely made it 😅`]
			);
		}

		// Ch3 checkins — all 7 days for charlie and alice
		for (let day = 1; day <= 7; day++) {
			await pool.query(
				`INSERT INTO checkins (challenge_id, user_id, cycle_number, caption, checked_in_at)
				 VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${10 - day} days')`,
				[ch3.id, charlie.id, day, `No sugar day ${day} 🍎`]
			);
			await pool.query(
				`INSERT INTO checkins (challenge_id, user_id, cycle_number, caption, checked_in_at)
				 VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${10 - day} days')`,
				[ch3.id, alice.id, day, `Sugar-free day ${day}!`]
			);
		}
		console.log('✅ Created checkins (19 total)');

		// =============================================
		// 6. Badges
		// =============================================
		const { rows: [badge1] } = await pool.query(
			`INSERT INTO badges (name, description, icon_url, condition_type, condition_value)
			 VALUES ('First Challenge', 'Completed your first challenge', '/badges/first.png', 'challenges_completed', 1)
			 RETURNING id`
		);
		const { rows: [badge2] } = await pool.query(
			`INSERT INTO badges (name, description, icon_url, condition_type, condition_value)
			 VALUES ('7-Day Streak', 'Maintained a 7-day streak', '/badges/streak7.png', 'streak_days', 7)
			 RETURNING id`
		);
		await pool.query(
			`INSERT INTO badges (name, description, icon_url, condition_type, condition_value)
			 VALUES ('Early Adopter', 'Joined during beta period', '/badges/early.png', 'early_adopter', 1)`
		);

		// Award badges
		await pool.query(
			`INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)`,
			[alice.id, badge1.id]
		);
		await pool.query(
			`INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)`,
			[charlie.id, badge1.id]
		);
		await pool.query(
			`INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)`,
			[alice.id, badge2.id]
		);
		console.log('✅ Created badges & awards');

		// =============================================
		// 7. Notifications
		// =============================================
		await pool.query(
			`INSERT INTO notifications (user_id, type, metadata, is_read) VALUES ($1, 'challenge_invite', $2, false)`,
			[charlie.id, JSON.stringify({ challengeId: ch1.id, invitedBy: alice.id })]
		);
		await pool.query(
			`INSERT INTO notifications (user_id, type, metadata, is_read) VALUES ($1, 'friend_request', $2, false)`,
			[alice.id, JSON.stringify({ fromUserId: diana.id, fromUsername: 'diana_fit' })]
		);
		await pool.query(
			`INSERT INTO notifications (user_id, type, metadata, is_read) VALUES ($1, 'friend_accepted', $2, true)`,
			[alice.id, JSON.stringify({ userId: bob.id, username: 'bob_the_builder' })]
		);
		await pool.query(
			`INSERT INTO notifications (user_id, type, metadata, is_read) VALUES ($1, 'badge_earned', $2, false)`,
			[alice.id, JSON.stringify({ badgeName: 'First Challenge', badgeId: badge1.id })]
		);
		console.log('✅ Created notifications');

		// =============================================
		// 8. Activities
		// =============================================
		await pool.query(
			`INSERT INTO activities (user_id, type, metadata) VALUES ($1, 'challenge_joined', $2)`,
			[alice.id, JSON.stringify({ challengeId: ch1.id, title: 'Wake Up at 6AM' })]
		);
		await pool.query(
			`INSERT INTO activities (user_id, type, metadata) VALUES ($1, 'checkin_done', $2)`,
			[alice.id, JSON.stringify({ challengeId: ch1.id, cycleNumber: 3 })]
		);
		await pool.query(
			`INSERT INTO activities (user_id, type, metadata) VALUES ($1, 'challenge_completed', $2)`,
			[alice.id, JSON.stringify({ challengeId: ch3.id, title: '7-Day No Sugar' })]
		);
		await pool.query(
			`INSERT INTO activities (user_id, type, metadata) VALUES ($1, 'badge_earned', $2)`,
			[alice.id, JSON.stringify({ badgeName: '7-Day Streak' })]
		);
		await pool.query(
			`INSERT INTO activities (user_id, type, metadata) VALUES ($1, 'friend_added', $2)`,
			[bob.id, JSON.stringify({ friendId: alice.id, friendUsername: 'alice' })]
		);
		console.log('✅ Created activities');

		console.log('\n🎉 Seed complete! Test credentials:');
		console.log('   Email: alice@example.com / bob@example.com / charlie@example.com / diana@example.com / edward@example.com');
		console.log('   Password: Password123!');
		console.log(`\n   alice  = ${alice.id}`);
		console.log(`   bob    = ${bob.id}`);
		console.log(`   charlie = ${charlie.id}`);
		console.log(`   diana  = ${diana.id}`);
		console.log(`   edward = ${edward.id}`);

	} catch (err) {
		console.error('Seed failed:', err);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

seed();
