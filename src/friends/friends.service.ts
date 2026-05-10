import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import {
	FriendRequest,
	FriendRequestStatus,
} from './friend-request.entity';
import { CreateFriendRequestDto } from './dto/friend.dto';

@Injectable()
export class FriendsService {
	constructor(
		@InjectRepository(FriendRequest)
		private readonly friendRequestRepo: Repository<FriendRequest>,
		private readonly usersService: UsersService,
	) { }

	async getOverview(userId: string) {
		const [pendingReceived, pendingSent, acceptedRequests] = await Promise.all([
			this.friendRequestRepo.find({
				where: { recipientId: userId, status: FriendRequestStatus.PENDING },
				order: { createdAt: 'DESC' },
			}),
			this.friendRequestRepo.find({
				where: { requesterId: userId, status: FriendRequestStatus.PENDING },
				order: { createdAt: 'DESC' },
			}),
			this.friendRequestRepo.find({
				where: [
					{ requesterId: userId, status: FriendRequestStatus.ACCEPTED },
					{ recipientId: userId, status: FriendRequestStatus.ACCEPTED },
				],
				order: { updatedAt: 'DESC' },
			}),
		]);

		return {
			pendingReceived: pendingReceived.map((item) =>
				this.toRequestSummary(item, userId),
			),
			pendingSent: pendingSent.map((item) => this.toRequestSummary(item, userId)),
			friends: acceptedRequests.map((item) => this.toFriendSummary(item, userId)),
		};
	}

	async sendRequest(userId: string, dto: CreateFriendRequestDto) {
		const normalizedUsername = dto.username.trim().toLowerCase();
		const recipient = await this.usersService.findByUsername(normalizedUsername);

		if (!recipient) {
			throw new NotFoundException('Không tìm thấy người dùng này');
		}

		if (recipient.id === userId) {
			throw new BadRequestException('Bạn không thể tự kết bạn với chính mình');
		}

		const existing = await this.friendRequestRepo.findOne({
			where: [
				{ requesterId: userId, recipientId: recipient.id },
				{ requesterId: recipient.id, recipientId: userId },
			],
		});

		if (existing?.status === FriendRequestStatus.ACCEPTED) {
			throw new ConflictException('Hai bạn đã là bạn bè');
		}

		if (existing?.status === FriendRequestStatus.PENDING) {
			if (existing.requesterId === userId) {
				throw new ConflictException('Bạn đã gửi lời mời trước đó');
			}

			throw new ConflictException('Người này đã gửi lời mời cho bạn');
		}

		const request = existing
			? this.friendRequestRepo.merge(existing, {
				requesterId: userId,
				recipientId: recipient.id,
				status: FriendRequestStatus.PENDING,
			})
			: this.friendRequestRepo.create({
				requesterId: userId,
				recipientId: recipient.id,
			});

		const saved = await this.friendRequestRepo.save(request);
		const hydrated = await this.friendRequestRepo.findOne({
			where: { id: saved.id },
		});

		if (!hydrated) {
			throw new NotFoundException('Không tìm thấy lời mời vừa tạo');
		}

		return {
			message: 'Đã gửi lời mời kết bạn',
			request: this.toRequestSummary(hydrated, userId),
		};
	}

	async acceptRequest(userId: string, requestId: string) {
		const request = await this.getPendingRequestOrThrow(requestId);

		if (request.recipientId !== userId) {
			throw new BadRequestException('Bạn không thể chấp nhận lời mời này');
		}

		request.status = FriendRequestStatus.ACCEPTED;
		const saved = await this.friendRequestRepo.save(request);

		return {
			message: 'Đã chấp nhận lời mời kết bạn',
			friend: this.toFriendSummary(saved, userId),
		};
	}

	async declineRequest(userId: string, requestId: string) {
		const request = await this.getPendingRequestOrThrow(requestId);

		if (request.recipientId !== userId) {
			throw new BadRequestException('Bạn không thể từ chối lời mời này');
		}

		request.status = FriendRequestStatus.DECLINED;
		await this.friendRequestRepo.save(request);

		return {
			message: 'Đã từ chối lời mời kết bạn',
		};
	}

	async removeFriend(userId: string, friendId: string) {
		const friendship = await this.friendRequestRepo.findOne({
			where: [
				{
					requesterId: userId,
					recipientId: friendId,
					status: FriendRequestStatus.ACCEPTED,
				},
				{
					requesterId: friendId,
					recipientId: userId,
					status: FriendRequestStatus.ACCEPTED,
				},
			],
		});

		if (!friendship) {
			throw new NotFoundException('Không tìm thấy mối quan hệ bạn bè');
		}

		await this.friendRequestRepo.remove(friendship);
		return { message: 'Đã xoá bạn bè' };
	}

	async areFriends(userId: string, otherUserId: string) {
		const friendship = await this.friendRequestRepo.findOne({
			where: [
				{
					requesterId: userId,
					recipientId: otherUserId,
					status: FriendRequestStatus.ACCEPTED,
				},
				{
					requesterId: otherUserId,
					recipientId: userId,
					status: FriendRequestStatus.ACCEPTED,
				},
			],
		});

		return !!friendship;
	}

	async getAcceptedFriendIds(userId: string) {
		const friendships = await this.friendRequestRepo.find({
			where: [
				{ requesterId: userId, status: FriendRequestStatus.ACCEPTED },
				{ recipientId: userId, status: FriendRequestStatus.ACCEPTED },
			],
		});

		return friendships.map((item) =>
			item.requesterId === userId ? item.recipientId : item.requesterId,
		);
	}

	private async getPendingRequestOrThrow(requestId: string) {
		const request = await this.friendRequestRepo.findOne({
			where: { id: requestId },
		});

		if (!request) {
			throw new NotFoundException('Không tìm thấy lời mời kết bạn');
		}

		if (request.status !== FriendRequestStatus.PENDING) {
			throw new ConflictException('Lời mời này đã được xử lý');
		}

		return request;
	}

	private toUserSummary(user: { id: string; email: string; username: string; avatarUrl?: string | null }) {
		return {
			id: user.id,
			email: user.email,
			username: user.username,
			avatarUrl: user.avatarUrl ?? null,
		};
	}

	private toRequestSummary(request: FriendRequest, currentUserId: string) {
		const otherUser =
			request.requesterId === currentUserId ? request.recipient : request.requester;

		return {
			id: request.id,
			status: request.status,
			createdAt: request.createdAt,
			direction:
				request.requesterId === currentUserId ? 'outgoing' : 'incoming',
			user: this.toUserSummary(otherUser),
		};
	}

	private toFriendSummary(request: FriendRequest, currentUserId: string) {
		const otherUser =
			request.requesterId === currentUserId ? request.recipient : request.requester;

		return {
			id: otherUser.id,
			email: otherUser.email,
			username: otherUser.username,
			avatarUrl: otherUser.avatarUrl ?? null,
			friendSince: request.updatedAt,
		};
	}
}