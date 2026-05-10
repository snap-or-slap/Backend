import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(User)
		private readonly userRepo: Repository<User>,
	) { }

	async findByEmail(email: string): Promise<User | null> {
		return this.userRepo.findOne({ where: { email } });
	}

	async findByUsername(username: string): Promise<User | null> {
		return this.userRepo.findOne({ where: { username } });
	}

	async findById(id: string): Promise<User | null> {
		return this.userRepo.findOne({ where: { id } });
	}

	async checkUsernameAvailability(username: string) {
		const normalizedUsername = username.trim().toLowerCase();
		const isFormatValid =
			normalizedUsername.length >= 4
			&& normalizedUsername.length <= 20
			&& /^[a-z0-9_]+$/.test(normalizedUsername);

		if (!isFormatValid) {
			return {
				available: false,
				isFormatValid: false,
			};
		}

		const existingUser = await this.findByUsername(normalizedUsername);

		return {
			available: !existingUser,
			isFormatValid: true,
		};
	}

	async getPublicProfileById(id: string) {
		const user = await this.findById(id);
		if (!user) {
			throw new NotFoundException('Không tìm thấy người dùng');
		}

		return this.toPublicProfile(user);
	}

	async updateProfile(id: string, dto: UpdateProfileDto) {
		const user = await this.findById(id);
		if (!user) {
			throw new NotFoundException('Không tìm thấy người dùng');
		}

		if (dto.avatarUrl !== undefined) {
			user.avatarUrl = dto.avatarUrl?.trim() || null;
		}

		const saved = await this.userRepo.save(user);
		return this.toPublicProfile(saved);
	}

	async create(data: { email: string; username: string; password: string }): Promise<User> {
		const existingEmail = await this.findByEmail(data.email);
		if (existingEmail) {
			throw new ConflictException('Email đã được sử dụng');
		}
		const existingUsername = await this.findByUsername(data.username);
		if (existingUsername) {
			throw new ConflictException('Username đã được sử dụng');
		}
		const user = this.userRepo.create({
			...data,
			avatarUrl: null,
		});
		return this.userRepo.save(user);
	}

	toPublicProfile(user: User) {
		return {
			id: user.id,
			email: user.email,
			username: user.username,
			avatarUrl: user.avatarUrl,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		};
	}
}
