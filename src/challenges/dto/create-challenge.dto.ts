import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayMinSize,
	ArrayMaxSize,
	IsArray,
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	Length,
	Matches,
	MaxLength,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChallengeTimeWindowDto {
	@ApiProperty({ example: '06:30' })
	@IsString()
	@Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime phải có dạng HH:mm' })
	startTime: string;

	@ApiPropertyOptional({ example: '08:30', description: 'Có thể bỏ trống nếu chỉ muốn nhắc tại một thời điểm cụ thể' })
	@IsOptional()
	@IsString()
	@Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime phải có dạng HH:mm' })
	endTime?: string;
}

export class ChallengeActivityDto {
	@ApiProperty({ example: 'Cardio' })
	@IsString()
	@Length(2, 120)
	name: string;

	@ApiProperty({ type: [ChallengeTimeWindowDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => ChallengeTimeWindowDto)
	timeWindows: ChallengeTimeWindowDto[];
}

export class CreateChallengeDto {
	@ApiProperty({ example: 'Chạy bộ cùng tôi' })
	@IsString()
	@Length(3, 120)
	name: string;

	@ApiProperty({ example: '2026-05-10' })
	@IsDateString()
	startsOn: string;

	@ApiProperty({ example: '2026-06-20' })
	@IsDateString()
	endsOn: string;

	@ApiProperty({ type: [ChallengeActivityDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(5)
	@ValidateNested({ each: true })
	@Type(() => ChallengeActivityDto)
	activities: ChallengeActivityDto[];

	@ApiPropertyOptional({ type: [String], description: 'Danh sách friend userId muốn mời ngay khi tạo' })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(6)
	@IsString({ each: true })
	initialInviteeIds?: string[];
}

export class InviteMembersDto {
	@ApiProperty({ type: [String] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(6)
	@IsString({ each: true })
	inviteeIds: string[];
}

export class SubmitChallengeEvidenceDto {
	private static readonly MAX_MEDIA_URL_LENGTH = 45_000_000;

	@ApiProperty({ description: 'Activity id trong challenge' })
	@IsString()
	activityId: string;

	@ApiProperty({ enum: ['image', 'video'] })
	@IsString()
	mediaType: 'image' | 'video';

	@ApiProperty({ description: 'Data URL của ảnh hoặc video' })
	@IsString()
	@MaxLength(SubmitChallengeEvidenceDto.MAX_MEDIA_URL_LENGTH)
	mediaUrl: string;

	@ApiPropertyOptional({ example: 'Hoàn thành 5km rồi' })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	caption?: string;

	@ApiPropertyOptional({ example: 28, description: 'Bắt buộc khi upload video' })
	@IsOptional()
	@IsInt()
	durationSeconds?: number;
}