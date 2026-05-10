import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
	@ApiPropertyOptional({
		description: 'Avatar URL hoặc data URI',
		example: 'data:image/jpeg;base64,...',
	})
	@IsOptional()
	@IsString()
	@MaxLength(6000000, { message: 'Avatar quá lớn' })
	avatarUrl?: string;
}