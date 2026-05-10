import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum FriendRequestStatus {
	PENDING = 'pending',
	ACCEPTED = 'accepted',
	DECLINED = 'declined',
}

@Entity('friend_requests')
@Index(['requesterId', 'recipientId'], { unique: true })
export class FriendRequest {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('uuid')
	requesterId: string;

	@Column('uuid')
	recipientId: string;

	@ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'requesterId' })
	requester: User;

	@ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'recipientId' })
	recipient: User;

	@Column({
		type: 'enum',
		enum: FriendRequestStatus,
		default: FriendRequestStatus.PENDING,
	})
	status: FriendRequestStatus;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}