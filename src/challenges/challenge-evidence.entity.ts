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
import { ChallengeActivity } from './challenge-activity.entity';
import { Challenge } from './challenge.entity';

export enum ChallengeEvidenceType {
	IMAGE = 'image',
	VIDEO = 'video',
}

@Entity('challenge_evidence')
@Index(['challengeId', 'userId', 'activityId', 'sessionDate'], { unique: true })
export class ChallengeEvidence {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	@Index()
	challengeId: string;

	@ManyToOne(() => Challenge, (challenge) => challenge.evidence, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'challengeId' })
	challenge: Challenge;

	@Column('uuid')
	@Index()
	userId: string;

	@ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column('uuid')
	@Index()
	activityId: string;

	@ManyToOne(() => ChallengeActivity, { eager: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'activityId' })
	activity: ChallengeActivity;

	@Column({ type: 'date' })
	sessionDate: string;

	@Column({
		type: 'enum',
		enum: ChallengeEvidenceType,
	})
	mediaType: ChallengeEvidenceType;

	@Column({ type: 'text' })
	mediaUrl: string;

	@Column({ type: 'varchar', length: 120, nullable: true })
	caption: string | null;

	@Column({ type: 'int', nullable: true })
	durationSeconds: number | null;

	@CreateDateColumn()
	createdAt: Date;
}