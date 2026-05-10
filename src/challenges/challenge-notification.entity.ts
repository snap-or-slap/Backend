import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Challenge } from './challenge.entity';

export enum ChallengeNotificationType {
	INVITED = 'invited',
	ACTIVITY_POSTED = 'activity_posted',
	MEMBER_MISSED = 'member_missed',
	INVITE_ACCEPTED = 'invite_accepted',
	INVITE_DECLINED = 'invite_declined',
	MEMBER_LEFT = 'member_left',
	HOST_TRANSFERRED = 'host_transferred',
}

@Entity('challenge_notifications')
@Index(['userId', 'createdAt'])
@Index(['dedupeKey'], { unique: true, where: '"dedupeKey" IS NOT NULL' })
export class ChallengeNotification {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	@Index()
	challengeId: string;

	@ManyToOne(() => Challenge, (challenge) => challenge.notifications, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'challengeId' })
	challenge: Challenge;

	@Column('uuid')
	@Index()
	userId: string;

	@ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column({
		type: 'enum',
		enum: ChallengeNotificationType,
	})
	type: ChallengeNotificationType;

	@Column({ length: 140 })
	title: string;

	@Column({ type: 'text' })
	body: string;

	@Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
	metadata: Record<string, unknown>;

	@Column({ type: 'varchar', length: 200, nullable: true })
	dedupeKey: string | null;

	@Column({ default: false })
	isRead: boolean;

	@CreateDateColumn()
	createdAt: Date;
}