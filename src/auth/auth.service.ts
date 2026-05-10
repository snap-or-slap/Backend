import {
	Injectable,
	UnauthorizedException,
	ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
	) { }

	async register(dto: RegisterDto) {
		const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

		const user = await this.usersService.create({
			email: dto.email,
			username: dto.username,
			password: hashedPassword,
		});

		const token = this.signToken(user.id, user.email, user.username);

		return {
			accessToken: token,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
				avatarUrl: user.avatarUrl,
			},
		};
	}

	async login(dto: LoginDto) {
		const user = await this.usersService.findByEmail(dto.email);
		if (!user) {
			throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
		}

		const isMatch = await bcrypt.compare(dto.password, user.password);
		if (!isMatch) {
			throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
		}

		const token = this.signToken(user.id, user.email, user.username);

		return {
			accessToken: token,
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
				avatarUrl: user.avatarUrl,
			},
		};
	}

	private signToken(userId: string, email: string, username: string): string {
		return this.jwtService.sign({
			sub: userId,
			email,
			username,
		});
	}
}
