import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Index({ unique: true })
	@Column({ unique: true })
	email: string;

	@Index({ unique: true })
	@Column({ unique: true })
	username: string;

	@Column({ type: 'text', nullable: true })
	avatarUrl: string | null;

	@Exclude()
	@Column()
	password: string;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
