import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Request,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
	CreateChallengeDto,
	InviteMembersDto,
	SubmitChallengeEvidenceDto,
} from './dto/create-challenge.dto';
import { ChallengesService } from './challenges.service';

@ApiTags('challenges')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('challenges')
export class ChallengesController {
	constructor(private readonly challengesService: ChallengesService) { }

	@Get('overview')
	@ApiOperation({ summary: 'Lấy challenge, lời mời challenge và thông báo challenge' })
	@ApiResponse({ status: 200, description: 'Challenges overview' })
	getOverview(@Request() req: any) {
		return this.challengesService.getOverview(req.user.id);
	}

	@Post()
	@ApiOperation({ summary: 'Tạo challenge mới' })
	@ApiResponse({ status: 201, description: 'Challenge đã được tạo' })
	createChallenge(@Request() req: any, @Body() dto: CreateChallengeDto) {
		return this.challengesService.createChallenge(req.user.id, dto);
	}

	@Get(':challengeId')
	@ApiOperation({ summary: 'Lấy chi tiết challenge' })
	@ApiResponse({ status: 200, description: 'Chi tiết challenge' })
	getDetail(@Request() req: any, @Param('challengeId') challengeId: string) {
		return this.challengesService.getChallengeDetail(req.user.id, challengeId);
	}

	@Delete(':challengeId/leave')
	@ApiOperation({ summary: 'Rời khỏi challenge hiện tại' })
	@ApiResponse({ status: 200, description: 'Đã rời challenge' })
	leaveChallenge(@Request() req: any, @Param('challengeId') challengeId: string) {
		return this.challengesService.leaveChallenge(req.user.id, challengeId);
	}

	@Post(':challengeId/invites')
	@ApiOperation({ summary: 'Mời bạn bè tham gia challenge' })
	@ApiResponse({ status: 201, description: 'Đã gửi lời mời challenge' })
	inviteMembers(
		@Request() req: any,
		@Param('challengeId') challengeId: string,
		@Body() dto: InviteMembersDto,
	) {
		return this.challengesService.inviteMembers(req.user.id, challengeId, dto.inviteeIds);
	}

	@Patch('invites/:inviteId/accept')
	@ApiOperation({ summary: 'Chấp nhận lời mời vào challenge' })
	acceptInvite(@Request() req: any, @Param('inviteId') inviteId: string) {
		return this.challengesService.respondToInvite(req.user.id, inviteId, true);
	}

	@Patch('invites/:inviteId/decline')
	@ApiOperation({ summary: 'Từ chối lời mời vào challenge' })
	declineInvite(@Request() req: any, @Param('inviteId') inviteId: string) {
		return this.challengesService.respondToInvite(req.user.id, inviteId, false);
	}

	@Post(':challengeId/evidence')
	@ApiOperation({ summary: 'Đăng ảnh hoặc video minh chứng đã hoàn thành challenge hôm nay' })
	@ApiResponse({ status: 201, description: 'Đã lưu minh chứng' })
	submitEvidence(
		@Request() req: any,
		@Param('challengeId') challengeId: string,
		@Body() dto: SubmitChallengeEvidenceDto,
	) {
		return this.challengesService.submitEvidence(req.user.id, challengeId, dto);
	}

	@Patch('notifications/read-all')
	@ApiOperation({ summary: 'Đánh dấu toàn bộ thông báo challenge là đã đọc' })
	markNotificationsRead(@Request() req: any) {
		return this.challengesService.markAllNotificationsRead(req.user.id);
	}
}