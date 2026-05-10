import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) { }

	@Post('register')
	@ApiOperation({ summary: 'Đăng ký tài khoản mới' })
	@ApiResponse({ status: 201, description: 'Đăng ký thành công, trả về JWT token' })
	@ApiResponse({ status: 409, description: 'Email hoặc username đã tồn tại' })
	register(@Body() dto: RegisterDto) {
		return this.authService.register(dto);
	}

	@Post('login')
	@ApiOperation({ summary: 'Đăng nhập' })
	@ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về JWT token' })
	@ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng' })
	login(@Body() dto: LoginDto) {
		return this.authService.login(dto);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Lấy thông tin user hiện tại từ JWT token' })
	@ApiResponse({ status: 200, description: 'Thông tin user' })
	@ApiResponse({ status: 401, description: 'Token không hợp lệ hoặc hết hạn' })
	getMe(@Request() req: any) {
		return { user: req.user };
	}

	@Post('logout')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Đăng xuất (client xoá token)' })
	logout() {
		// JWT stateless — client tự xoá token
		return { message: 'Đăng xuất thành công' };
	}
}
