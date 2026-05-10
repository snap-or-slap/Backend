import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateFriendRequestDto {
	@ApiProperty({ example: 'sam_riv', minLength: 4, maxLength: 20 })
	@IsString()
	@MinLength(4, { message: 'Username tối thiểu 4 ký tự' })
	@MaxLength(20, { message: 'Username tối đa 20 ký tự' })
	@Matches(/^[a-z0-9_]+$/, {
		message: 'Username chỉ được dùng chữ thường, số và dấu _',
	})
	username: string;
}