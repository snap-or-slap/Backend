import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Challenge } from './challenge.entity';

export enum ChallengeInviteStatus {
	PENDING = 'pending',
	ACCEPTED = 'accepted',
	DECLINED = 'declined',
}

@Entity('challenge_invites')
@Index(['challengeId', 'inviteeId'], { unique: true })
export class ChallengeInvite {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	@Index()
	challengeId: string;

	@ManyToOne(() => Challenge, (challenge) => challenge.invites, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'challengeId' })
	challenge: Challenge;

	@Column('uuid')
	inviterId: string;

	@ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'inviterId' })
	inviter: User;

	@Column('uuid')
	@Index()
	inviteeId: string;

	@ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'inviteeId' })
	invitee: User;

	@Column({
		type: 'enum',
		enum: ChallengeInviteStatus,
		default: ChallengeInviteStatus.PENDING,
	})
	status: ChallengeInviteStatus;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}