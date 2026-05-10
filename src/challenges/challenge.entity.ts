import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ChallengeActivity } from './challenge-activity.entity';
import { ChallengeEvidence } from './challenge-evidence.entity';
import { ChallengeInvite } from './challenge-invite.entity';
import { ChallengeMember } from './challenge-member.entity';
import { ChallengeNotification } from './challenge-notification.entity';

export enum ChallengeStatus {
	ACTIVE = 'active',
	COMPLETED = 'completed',
	CANCELLED = 'cancelled',
}

@Entity('challenges')
export class Challenge {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	@Index()
	hostId: string;

	@ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'hostId' })
	host: User;

	@Column({ length: 120 })
	name: string;

	@Column({ type: 'date' })
	startsOn: string;

	@Column({ type: 'date' })
	endsOn: string;

	@Column({
		type: 'enum',
		enum: ChallengeStatus,
		default: ChallengeStatus.ACTIVE,
	})
	status: ChallengeStatus;

	@OneToMany(() => ChallengeMember, (member) => member.challenge)
	members: ChallengeMember[];

	@OneToMany(() => ChallengeActivity, (activity) => activity.challenge)
	activities: ChallengeActivity[];

	@OneToMany(() => ChallengeInvite, (invite) => invite.challenge)
	invites: ChallengeInvite[];

	@OneToMany(() => ChallengeEvidence, (evidence) => evidence.challenge)
	evidence: ChallengeEvidence[];

	@OneToMany(() => ChallengeNotification, (notification) => notification.challenge)
	notifications: ChallengeNotification[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}