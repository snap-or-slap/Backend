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

export enum ChallengeMemberRole {
	HOST = 'host',
	MEMBER = 'member',
}

@Entity('challenge_members')
@Index(['challengeId', 'userId'], { unique: true })
export class ChallengeMember {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	@Index()
	challengeId: string;

	@ManyToOne(() => Challenge, (challenge) => challenge.members, { onDelete: 'CASCADE' })
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
		enum: ChallengeMemberRole,
		default: ChallengeMemberRole.MEMBER,
	})
	role: ChallengeMemberRole;

	@CreateDateColumn()
	joinedAt: Date;
}