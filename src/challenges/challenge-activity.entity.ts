import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { ChallengeEvidence } from './challenge-evidence.entity';
import { ChallengeSchedule } from './challenge-schedule.entity';
import { Challenge } from './challenge.entity';

@Entity('challenge_activities')
@Index(['challengeId', 'name'], { unique: true })
export class ChallengeActivity {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	@Index()
	challengeId: string;

	@ManyToOne(() => Challenge, (challenge) => challenge.activities, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'challengeId' })
	challenge: Challenge;

	@Column({ length: 120 })
	name: string;

	@Column({ type: 'int', default: 0 })
	sortOrder: number;

	@OneToMany(() => ChallengeSchedule, (timeWindow) => timeWindow.activity)
	timeWindows: ChallengeSchedule[];

	@OneToMany(() => ChallengeEvidence, (evidence) => evidence.activity)
	evidence: ChallengeEvidence[];
}