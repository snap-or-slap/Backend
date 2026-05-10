import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
	@ApiProperty({ example: 'user@example.com' })
	@IsEmail({}, { message: 'Email không hợp lệ' })
	email: string;

	@ApiProperty({ example: 'password123', minLength: 6 })
	@IsString()
	@MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
	password: string;

	@ApiProperty({ example: 'myusername', minLength: 4, maxLength: 20 })
	@IsString()
	@MinLength(4, { message: 'Username tối thiểu 4 ký tự' })
	@MaxLength(20, { message: 'Username tối đa 20 ký tự' })
	@Matches(/^[a-z0-9_]+$/, { message: 'Username chỉ được dùng chữ thường, số và dấu _' })
	username: string;
}

export class LoginDto {
	@ApiProperty({ example: 'user@example.com' })
	@IsEmail({}, { message: 'Email không hợp lệ' })
	email: string;

	@ApiProperty({ example: 'password123' })
	@IsString()
	@MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
	password: string;
}
