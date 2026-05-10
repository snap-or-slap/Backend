import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) { }

	@Get('check-username/:username')
	@ApiOperation({ summary: 'Kiểm tra username có sẵn hay không' })
	@ApiResponse({ status: 200, description: 'Kết quả kiểm tra username' })
	checkUsername(@Param('username') username: string) {
		return this.usersService.checkUsernameAvailability(username);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Lấy thông tin profile của tài khoản hiện tại' })
	@ApiResponse({ status: 200, description: 'Profile hiện tại' })
	getMe(@Request() req: any) {
		return this.usersService.getPublicProfileById(req.user.id);
	}

	@Patch('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Cập nhật profile của tài khoản hiện tại' })
	@ApiResponse({ status: 200, description: 'Profile đã được cập nhật' })
	updateMe(@Request() req: any, @Body() dto: UpdateProfileDto) {
		return this.usersService.updateProfile(req.user.id, dto);
	}

	@Get(':id')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Xem profile của một user' })
	@ApiResponse({ status: 200, description: 'Thông tin profile của user' })
	getById(@Param('id') id: string) {
		return this.usersService.getPublicProfileById(id);
	}
}