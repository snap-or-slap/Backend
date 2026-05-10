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
import { CreateFriendRequestDto } from './dto/friend.dto';
import { FriendsService } from './friends.service';

@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
	constructor(private readonly friendsService: FriendsService) { }

	@Get('overview')
	@ApiOperation({ summary: 'Lấy danh sách bạn bè và lời mời kết bạn' })
	@ApiResponse({ status: 200, description: 'Dữ liệu friends overview' })
	getOverview(@Request() req: any) {
		return this.friendsService.getOverview(req.user.id);
	}

	@Post('requests')
	@ApiOperation({ summary: 'Gửi lời mời kết bạn theo username' })
	@ApiResponse({ status: 201, description: 'Gửi lời mời thành công' })
	sendRequest(@Request() req: any, @Body() dto: CreateFriendRequestDto) {
		return this.friendsService.sendRequest(req.user.id, dto);
	}

	@Patch('requests/:id/accept')
	@ApiOperation({ summary: 'Chấp nhận lời mời kết bạn' })
	@ApiResponse({ status: 200, description: 'Chấp nhận thành công' })
	acceptRequest(@Request() req: any, @Param('id') id: string) {
		return this.friendsService.acceptRequest(req.user.id, id);
	}

	@Patch('requests/:id/decline')
	@ApiOperation({ summary: 'Từ chối lời mời kết bạn' })
	@ApiResponse({ status: 200, description: 'Từ chối thành công' })
	declineRequest(@Request() req: any, @Param('id') id: string) {
		return this.friendsService.declineRequest(req.user.id, id);
	}

	@Delete(':friendId')
	@ApiOperation({ summary: 'Xoá bạn bè' })
	@ApiResponse({ status: 200, description: 'Xoá bạn thành công' })
	removeFriend(@Request() req: any, @Param('friendId') friendId: string) {
		return this.friendsService.removeFriend(req.user.id, friendId);
	}
}