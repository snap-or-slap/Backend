import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { ChallengeActivity } from './challenge-activity.entity';

@Entity('challenge_schedules')
@Index(['activityId', 'sortOrder'], { unique: true })
export class ChallengeSchedule {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	activityId: string;

	@ManyToOne(() => ChallengeActivity, (activity) => activity.timeWindows, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'activityId' })
	activity: ChallengeActivity;

	@Column({ type: 'varchar', length: 5 })
	startTime: string;

	@Column({ type: 'varchar', length: 5, nullable: true })
	endTime: string | null;

	@Column({ type: 'int', default: 0 })
	sortOrder: number;
}