import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FriendsService } from '../friends/friends.service';
import { UsersService } from '../users/users.service';
import { ChallengeActivity } from './challenge-activity.entity';
import { ChallengeEvidence, ChallengeEvidenceType } from './challenge-evidence.entity';
import { ChallengeGateway } from './challenge.gateway';
import { ChallengeInvite, ChallengeInviteStatus } from './challenge-invite.entity';
import { ChallengeMember, ChallengeMemberRole } from './challenge-member.entity';
import {
	ChallengeNotification,
	ChallengeNotificationType,
} from './challenge-notification.entity';
import { ChallengeSchedule } from './challenge-schedule.entity';
import { Challenge, ChallengeStatus } from './challenge.entity';
import {
	CreateChallengeDto,
	SubmitChallengeEvidenceDto,
} from './dto/create-challenge.dto';

const MAX_CHALLENGE_DAYS = 62;
const MAX_CHALLENGE_MEMBERS = 7;
const MAX_CHALLENGE_ACTIVITIES = 5;
const MAX_VIDEO_DURATION_SECONDS = 30;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

@Injectable()
export class ChallengesService {
	constructor(
		@InjectRepository(Challenge)
		private readonly challengeRepo: Repository<Challenge>,
		@InjectRepository(ChallengeActivity)
		private readonly activityRepo: Repository<ChallengeActivity>,
		@InjectRepository(ChallengeMember)
		private readonly memberRepo: Repository<ChallengeMember>,
		@InjectRepository(ChallengeSchedule)
		private readonly scheduleRepo: Repository<ChallengeSchedule>,
		@InjectRepository(ChallengeInvite)
		private readonly inviteRepo: Repository<ChallengeInvite>,
		@InjectRepository(ChallengeEvidence)
		private readonly evidenceRepo: Repository<ChallengeEvidence>,
		@InjectRepository(ChallengeNotification)
		private readonly notificationRepo: Repository<ChallengeNotification>,
		private readonly usersService: UsersService,
		private readonly friendsService: FriendsService,
		private readonly challengeGateway: ChallengeGateway,
	) { }

	async getOverview(userId: string) {
		await this.syncMissedActivityNotifications(userId);

		const [memberships, invites, notifications] = await Promise.all([
			this.memberRepo.find({
				where: { userId },
				relations: {
					challenge: {
						host: true,
						activities: { timeWindows: true },
						members: { user: true },
					},
				},
				order: { joinedAt: 'DESC' },
			}),
			this.inviteRepo.find({
				where: {
					inviteeId: userId,
					status: ChallengeInviteStatus.PENDING,
				},
				relations: {
					challenge: { host: true, activities: { timeWindows: true }, members: { user: true } },
				},
				order: { createdAt: 'DESC' },
			}),
			this.notificationRepo.find({
				where: { userId },
				relations: { challenge: true },
				order: { createdAt: 'DESC' },
				take: 30,
			}),
		]);

		return {
			challenges: memberships.map((item) => this.toChallengeCard(item.challenge, userId)),
			invites: invites.map((item) => this.toInviteSummary(item)),
			notifications: notifications.map((item) => this.toNotificationSummary(item)),
			unreadNotificationCount: notifications.filter((item) => !item.isRead).length,
		};
	}

	async createChallenge(userId: string, dto: CreateChallengeDto) {
		const host = await this.usersService.findById(userId);
		if (!host) {
			throw new NotFoundException('Không tìm thấy host');
		}

		this.validateChallengeWindow(dto.startsOn, dto.endsOn);
		const activities = this.normalizeActivities(dto.activities);

		const inviteeIds = [...new Set(dto.initialInviteeIds ?? [])].filter((id) => id !== userId);
		if (inviteeIds.length + 1 > MAX_CHALLENGE_MEMBERS) {
			throw new BadRequestException(`Mỗi challenge tối đa ${MAX_CHALLENGE_MEMBERS} người`);
		}

		for (const inviteeId of inviteeIds) {
			const isFriend = await this.friendsService.areFriends(userId, inviteeId);
			if (!isFriend) {
				throw new ForbiddenException('Chỉ được mời bạn bè của mình vào challenge');
			}
		}

		const challenge = await this.challengeRepo.save(
			this.challengeRepo.create({
				hostId: userId,
				name: dto.name.trim(),
				startsOn: dto.startsOn,
				endsOn: dto.endsOn,
				status: ChallengeStatus.ACTIVE,
			}),
		);

		await this.memberRepo.save(
			this.memberRepo.create({
				challengeId: challenge.id,
				userId,
				role: ChallengeMemberRole.HOST,
			}),
		);

		for (const [activityIndex, activity] of activities.entries()) {
			const savedActivity = await this.activityRepo.save(
				this.activityRepo.create({
					challengeId: challenge.id,
					name: activity.name,
					sortOrder: activityIndex,
				}),
			);

			await this.scheduleRepo.save(
				activity.timeWindows.map((timeWindow, windowIndex) =>
					this.scheduleRepo.create({
						activityId: savedActivity.id,
						startTime: timeWindow.startTime,
						endTime: timeWindow.endTime,
						sortOrder: windowIndex,
					}),
				),
			);
		}

		if (inviteeIds.length > 0) {
			await this.createInvites(challenge, host.username, userId, inviteeIds);
		}

		const saved = await this.challengeRepo.findOne({
			where: { id: challenge.id },
			relations: { host: true, activities: { timeWindows: true }, members: { user: true } },
		});

		return {
			message: 'Đã tạo challenge',
			challenge: this.toChallengeCard(saved!, userId),
		};
	}

	async getChallengeDetail(userId: string, challengeId: string) {
		const challenge = await this.getChallengeWithRelationsOrThrow(challengeId);
		const member = challenge.members.find((item) => item.userId === userId);
		if (!member) {
			throw new ForbiddenException('Bạn không thuộc challenge này');
		}

		await this.syncMissedActivityNotifications(userId, challengeId);
		const freshChallenge = await this.getChallengeWithRelationsOrThrow(challengeId);
		const sessions = this.buildSessions(freshChallenge);
		const availableFriendIds = await this.friendsService.getAcceptedFriendIds(userId);
		const availableInviteFriends = (
			await Promise.all(availableFriendIds.map((friendId) => this.usersService.findById(friendId)))
		)
			.filter((friend): friend is NonNullable<typeof friend> => !!friend)
			.filter(
				(friend) =>
					!freshChallenge.members.some((entry) => entry.userId === friend.id)
					&& !freshChallenge.invites.some(
						(entry) => entry.inviteeId === friend.id && entry.status === ChallengeInviteStatus.PENDING,
					),
			)
			.map((friend) => this.toUserSummary(friend));

		return {
			challenge: {
				id: freshChallenge.id,
				name: freshChallenge.name,
				status: freshChallenge.status,
				startsOn: freshChallenge.startsOn,
				endsOn: freshChallenge.endsOn,
				canLeave: true,
				currentUserRole: member.role,
				host: this.toUserSummary(freshChallenge.host),
				activities: this.toActivitySummaries(freshChallenge.activities, freshChallenge),
				members: freshChallenge.members.map((item) => ({
					role: item.role,
					...this.toUserSummary(item.user),
				})),
				feed: freshChallenge.evidence
					.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
					.map((item) => this.toEvidenceSummary(item)),
				pendingInvites: freshChallenge.invites
					.filter((item) => item.status === ChallengeInviteStatus.PENDING)
					.map((item) => this.toInviteSummary(item)),
				sessions,
				availableInviteFriends,
			},
		};
	}

	async leaveChallenge(userId: string, challengeId: string) {
		const challenge = await this.getChallengeWithRelationsOrThrow(challengeId);
		const member = challenge.members.find((item) => item.userId === userId);
		if (!member) {
			throw new ForbiddenException('Bạn không thuộc challenge này');
		}

		const remainingMembers = [...challenge.members]
			.filter((item) => item.userId !== userId)
			.sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime());

		await this.memberRepo.remove(member);

		if (remainingMembers.length === 0) {
			await this.challengeRepo.remove(challenge);
			return { message: 'Đã rời challenge. Challenge đã được đóng vì không còn thành viên nào.' };
		}

		const notificationRecipients = remainingMembers.map((item) => item.userId);
		const leavingUsername = member.user.username;

		if (challenge.hostId === userId) {
			const nextHost = remainingMembers[0];
			nextHost.role = ChallengeMemberRole.HOST;
			await this.memberRepo.save(nextHost);
			challenge.hostId = nextHost.userId;
			await this.challengeRepo.save(challenge);

			for (const recipientId of notificationRecipients) {
				await this.createNotification({
					challengeId,
					userId: recipientId,
					type: ChallengeNotificationType.HOST_TRANSFERRED,
					title: `Host của challenge ${challenge.name} đã thay đổi`,
					body: recipientId === nextHost.userId
						? `Vì @${leavingUsername} đã rời challenge ${challenge.name}, bạn hiện là host mới.`
						: `@${leavingUsername} đã rời challenge ${challenge.name}. Host mới là @${nextHost.user.username}.`,
					metadata: {
						eventKey: this.buildEventKey('host-transferred', challengeId, userId, nextHost.userId, recipientId),
						challengeId,
						leftUserId: userId,
						newHostUserId: nextHost.userId,
					},
					dedupeKey: this.buildEventKey('host-transferred', challengeId, userId, nextHost.userId, recipientId),
				});
			}
		} else {
			for (const recipientId of notificationRecipients) {
				await this.createNotification({
					challengeId,
					userId: recipientId,
					type: ChallengeNotificationType.MEMBER_LEFT,
					title: `Có thành viên rời challenge ${challenge.name}`,
					body: `@${leavingUsername} đã rời khỏi challenge ${challenge.name}.`,
					metadata: {
						eventKey: this.buildEventKey('member-left', challengeId, userId, recipientId),
						challengeId,
						leftUserId: userId,
					},
					dedupeKey: this.buildEventKey('member-left', challengeId, userId, recipientId),
				});
			}
		}

		this.challengeGateway.emitChallengeUpdate(challengeId, {
			challengeId,
			kind: 'member-left',
			userId,
		});

		return { message: 'Bạn đã rời khỏi challenge.' };
	}

	async inviteMembers(userId: string, challengeId: string, inviteeIds: string[]) {
		const challenge = await this.getChallengeWithRelationsOrThrow(challengeId);
		const inviterMember = challenge.members.find((item) => item.userId === userId);
		if (!inviterMember) {
			throw new ForbiddenException('Bạn không thuộc challenge này');
		}

		const normalizedInviteeIds = [...new Set(inviteeIds)].filter((id) => id !== userId);
		if (normalizedInviteeIds.length === 0) {
			throw new BadRequestException('Cần chọn ít nhất một người để mời');
		}

		const occupiedSlots =
			challenge.members.length
			+ challenge.invites.filter((item) => item.status === ChallengeInviteStatus.PENDING).length;
		if (occupiedSlots + normalizedInviteeIds.length > MAX_CHALLENGE_MEMBERS) {
			throw new BadRequestException(`Mỗi challenge tối đa ${MAX_CHALLENGE_MEMBERS} người`);
		}

		for (const inviteeId of normalizedInviteeIds) {
			if (challenge.members.some((member) => member.userId === inviteeId)) {
				throw new ConflictException('Người này đã ở trong challenge');
			}
			if (
				challenge.invites.some(
					(invite) => invite.inviteeId === inviteeId && invite.status === ChallengeInviteStatus.PENDING,
				)
			) {
				throw new ConflictException('Đã có lời mời đang chờ cho người này');
			}

			const isFriend = await this.friendsService.areFriends(userId, inviteeId);
			if (!isFriend) {
				throw new ForbiddenException('Chỉ được mời bạn của chính bạn đang ở trong challenge');
			}
		}

		await this.createInvites(challenge, inviterMember.user.username, userId, normalizedInviteeIds);

		return { message: 'Đã gửi lời mời tham gia challenge' };
	}

	async respondToInvite(userId: string, inviteId: string, shouldAccept: boolean) {
		const invite = await this.inviteRepo.findOne({
			where: { id: inviteId },
			relations: {
				challenge: {
					host: true,
					members: { user: true },
					activities: { timeWindows: true },
					invites: true,
				},
				inviter: true,
			},
		});

		if (!invite || invite.inviteeId !== userId) {
			throw new NotFoundException('Không tìm thấy lời mời challenge');
		}

		if (invite.status !== ChallengeInviteStatus.PENDING) {
			throw new ConflictException('Lời mời này đã được xử lý');
		}

		if (shouldAccept) {
			const activeCount = invite.challenge.members.length;
			if (activeCount >= MAX_CHALLENGE_MEMBERS) {
				throw new ConflictException('Challenge đã đủ số lượng thành viên');
			}

			invite.status = ChallengeInviteStatus.ACCEPTED;
			await this.inviteRepo.save(invite);
			await this.memberRepo.save(
				this.memberRepo.create({
					challengeId: invite.challengeId,
					userId,
					role: ChallengeMemberRole.MEMBER,
				}),
			);
			await this.createNotification({
				challengeId: invite.challengeId,
				userId: invite.inviterId,
				type: ChallengeNotificationType.INVITE_ACCEPTED,
				title: `@${invite.invitee.username} đã vào challenge ${invite.challenge.name}`,
				body: `Lời mời của bạn đã được chấp nhận. @${invite.invitee.username} hiện là thành viên của challenge ${invite.challenge.name}.`,
				metadata: {
					eventKey: this.buildEventKey('invite-accepted', invite.id, invite.inviterId),
					challengeId: invite.challengeId,
					inviteId: invite.id,
					inviteeId: invite.inviteeId,
				},
				dedupeKey: this.buildEventKey('invite-accepted', invite.id, invite.inviterId),
			});
		} else {
			invite.status = ChallengeInviteStatus.DECLINED;
			await this.inviteRepo.save(invite);
			await this.createNotification({
				challengeId: invite.challengeId,
				userId: invite.inviterId,
				type: ChallengeNotificationType.INVITE_DECLINED,
				title: `@${invite.invitee.username} đã từ chối challenge ${invite.challenge.name}`,
				body: `Lời mời tham gia challenge ${invite.challenge.name} đã bị @${invite.invitee.username} từ chối.`,
				metadata: {
					eventKey: this.buildEventKey('invite-declined', invite.id, invite.inviterId),
					challengeId: invite.challengeId,
					inviteId: invite.id,
					inviteeId: invite.inviteeId,
				},
				dedupeKey: this.buildEventKey('invite-declined', invite.id, invite.inviterId),
			});
		}

		this.challengeGateway.emitChallengeUpdate(invite.challengeId, {
			challengeId: invite.challengeId,
			kind: shouldAccept ? 'member-joined' : 'invite-declined',
		});

		return {
			message: shouldAccept ? 'Đã tham gia challenge' : 'Đã từ chối lời mời challenge',
		};
	}

	async submitEvidence(userId: string, challengeId: string, dto: SubmitChallengeEvidenceDto) {
		const challenge = await this.getChallengeWithRelationsOrThrow(challengeId);
		const member = challenge.members.find((item) => item.userId === userId);
		if (!member) {
			throw new ForbiddenException('Bạn không thuộc challenge này');
		}

		const activity = challenge.activities.find((item) => item.id === dto.activityId);
		if (!activity) {
			throw new NotFoundException('Không tìm thấy hoạt động trong challenge này');
		}

		const mediaType = dto.mediaType === 'video' ? ChallengeEvidenceType.VIDEO : ChallengeEvidenceType.IMAGE;
		if (mediaType === ChallengeEvidenceType.VIDEO) {
			if (!dto.durationSeconds || dto.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
				throw new BadRequestException(`Video phải ngắn hơn hoặc bằng ${MAX_VIDEO_DURATION_SECONDS} giây`);
			}
		}

		const now = new Date();
		const sessionDate = this.toDateKey(now);
		if (!this.isDateWithinChallenge(now, challenge)) {
			throw new BadRequestException('Hiện chưa nằm trong thời gian diễn ra của challenge');
		}
		if (!this.isInsideAnyTimeWindow(now, activity.timeWindows)) {
			throw new BadRequestException('Hiện chưa nằm trong khung giờ của phiên hoạt động');
		}

		const existing = await this.evidenceRepo.findOne({
			where: { challengeId, userId, activityId: dto.activityId, sessionDate },
		});
		if (existing) {
			throw new ConflictException('Mỗi hoạt động mỗi ngày trong challenge chỉ được đăng một ảnh hoặc video');
		}

		const evidence = await this.evidenceRepo.save(
			this.evidenceRepo.create({
				challengeId,
				userId,
				activityId: dto.activityId,
				sessionDate,
				mediaType,
				mediaUrl: dto.mediaUrl,
				caption: dto.caption?.trim() || null,
				durationSeconds: dto.durationSeconds ?? null,
			}),
		);

		const recipients = challenge.members
			.filter((item) => item.userId !== userId)
			.map((item) => item.userId);

		for (const recipientId of recipients) {
			const eventKey = this.buildEventKey('activity-posted', evidence.id, recipientId);
			await this.createNotification({
				challengeId,
				userId: recipientId,
				type: ChallengeNotificationType.ACTIVITY_POSTED,
				title: `@${member.user.username} đã hoàn thành ${activity.name}`,
				body: `@${member.user.username} vừa đăng minh chứng cho hoạt động ${activity.name} trong challenge ${challenge.name} vào ${this.formatClock(now)}.`,
				metadata: {
					eventKey,
					challengeId,
					evidenceId: evidence.id,
					activityId: dto.activityId,
					actorUserId: userId,
					sessionDate,
				},
				dedupeKey: eventKey,
			});
		}

		this.challengeGateway.emitChallengeUpdate(challengeId, {
			challengeId,
			kind: 'evidence-posted',
			evidenceId: evidence.id,
			userId,
		});

		return {
			message: 'Đã lưu minh chứng hoàn thành thử thách',
			evidence: this.toEvidenceSummary({ ...evidence, user: member.user, activity } as ChallengeEvidence),
		};
	}

	async markAllNotificationsRead(userId: string) {
		await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
		return { message: 'Đã đánh dấu thông báo là đã đọc' };
	}

	private async createInvites(
		challenge: Challenge,
		inviterName: string,
		inviterId: string,
		inviteeIds: string[],
	) {
		const invitees = await Promise.all(inviteeIds.map((id) => this.usersService.findById(id)));
		const missing = invitees.find((item) => !item);
		if (missing === undefined) {
			const inviteEntities = inviteeIds.map((inviteeId) =>
				this.inviteRepo.create({
					challengeId: challenge.id,
					inviterId,
					inviteeId,
					status: ChallengeInviteStatus.PENDING,
				}),
			);
			const savedInvites = await this.inviteRepo.save(inviteEntities);

			for (const invite of savedInvites) {
				const eventKey = this.buildEventKey('invited', invite.id, invite.inviteeId);
				await this.createNotification({
					challengeId: challenge.id,
					userId: invite.inviteeId,
					type: ChallengeNotificationType.INVITED,
					title: `Bạn được mời vào challenge ${challenge.name}`,
					body: `@${inviterName} đã mời bạn tham gia challenge ${challenge.name}. Hãy mở app để xem các hoạt động và quyết định tham gia.`,
					metadata: {
						eventKey,
						challengeId: challenge.id,
						inviterId,
					},
					dedupeKey: eventKey,
				});
			}

			this.challengeGateway.emitChallengeUpdate(challenge.id, {
				challengeId: challenge.id,
				kind: 'invites-created',
			});
			return;
		}

		throw new NotFoundException('Có người được mời không tồn tại');
	}

	private async createNotification(input: {
		challengeId: string;
		userId: string;
		type: ChallengeNotificationType;
		title: string;
		body: string;
		metadata: Record<string, unknown>;
		dedupeKey: string;
	}) {
		const existing = await this.notificationRepo.findOne({
			where: { dedupeKey: input.dedupeKey },
		});
		if (existing) {
			existing.title = input.title;
			existing.body = input.body;
			existing.metadata = input.metadata;
			return this.notificationRepo.save(existing);
		}

		const notification = await this.notificationRepo.save(
			this.notificationRepo.create({
				challengeId: input.challengeId,
				userId: input.userId,
				type: input.type,
				title: input.title,
				body: input.body,
				metadata: input.metadata,
				dedupeKey: input.dedupeKey,
			}),
		);

		this.challengeGateway.emitToUsers([input.userId], 'challenge.notification', {
			notification: this.toNotificationSummary(notification),
		});

		return notification;
	}

	private async syncMissedActivityNotifications(userId: string, onlyChallengeId?: string) {
		const memberships = await this.memberRepo.find({
			where: onlyChallengeId ? { userId, challengeId: onlyChallengeId } : { userId },
			relations: {
				challenge: {
					activities: { timeWindows: true },
					members: { user: true },
					evidence: { activity: true },
				},
			},
		});

		const today = this.toDateKey(new Date());
		for (const membership of memberships) {
			for (const session of this.buildSessions(membership.challenge)) {
				if (session.date >= today) {
					continue;
				}

				for (const memberStatus of session.members) {
					if (memberStatus.status !== 'missed' || memberStatus.user.id === userId) {
						continue;
					}

					await this.createNotification({
						challengeId: membership.challengeId,
						userId,
						type: ChallengeNotificationType.MEMBER_MISSED,
						title: `@${memberStatus.user.username} đã bỏ lỡ ${session.activityName}`,
						body: `@${memberStatus.user.username} chưa đăng minh chứng cho hoạt động ${session.activityName} của challenge ${membership.challenge.name} trong ngày ${session.date}.`,
						metadata: {
							eventKey: this.buildEventKey(
								'missed',
								membership.challengeId,
								session.activityId,
								session.date,
								memberStatus.user.id,
								userId,
							),
							challengeId: membership.challengeId,
							activityId: session.activityId,
							missedUserId: memberStatus.user.id,
							sessionDate: session.date,
						},
						dedupeKey: this.buildEventKey(
							'missed',
							membership.challengeId,
							session.activityId,
							session.date,
							memberStatus.user.id,
							userId,
						),
					});
				}
			}
		}
	}

	private buildEventKey(kind: string, ...parts: Array<string | number | null | undefined>) {
		return [kind, ...parts]
			.map((part) => String(part ?? 'null').trim())
			.join(':');
	}

	private buildSessions(challenge: Challenge) {
		const evidenceByKey = new Map(
			challenge.evidence.map((item) => [`${item.userId}:${item.activityId}:${item.sessionDate}`, item]),
		);
		const sessions: Array<{
			date: string;
			activityId: string;
			activityName: string;
			label: string;
			windowLabel: string;
			members: Array<{
				user: ReturnType<ChallengesService['toUserSummary']>;
				status: 'completed' | 'missed' | 'upcoming';
				evidence: ReturnType<ChallengesService['toEvidenceSummary']> | null;
			}>;
		}> = [];

		const today = this.toDateKey(new Date());
		for (const date of this.enumerateDateKeys(challenge.startsOn, challenge.endsOn)) {
			for (const activity of [...challenge.activities].sort((left, right) => left.sortOrder - right.sortOrder)) {
				sessions.push({
					date,
					activityId: activity.id,
					activityName: activity.name,
					label: this.formatDateLabel(date),
					windowLabel: this.formatTimeWindowList(activity.timeWindows),
					members: challenge.members.map((member) => {
						const evidence = evidenceByKey.get(`${member.userId}:${activity.id}:${date}`) ?? null;
						const status = evidence
							? 'completed'
							: date < today
								? 'missed'
								: 'upcoming';

						return {
							user: this.toUserSummary(member.user),
							status,
							evidence: evidence ? this.toEvidenceSummary(evidence) : null,
						};
					}),
				});
			}
		}

		return sessions.reverse().slice(0, 20);
	}

	private async getChallengeWithRelationsOrThrow(challengeId: string) {
		const challenge = await this.challengeRepo.findOne({
			where: { id: challengeId },
			relations: {
				host: true,
				activities: { timeWindows: true },
				members: { user: true },
				invites: { inviter: true, invitee: true },
				evidence: { user: true, activity: { timeWindows: true } },
			},
		});

		if (!challenge) {
			throw new NotFoundException('Không tìm thấy challenge');
		}

		return challenge;
	}

	private validateChallengeWindow(startsOn: string, endsOn: string) {
		const start = this.parseDateKey(startsOn);
		const end = this.parseDateKey(endsOn);
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
			throw new BadRequestException('Ngày challenge không hợp lệ');
		}
		if (end < start) {
			throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
		}

		const dayDiff = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
		if (dayDiff > MAX_CHALLENGE_DAYS) {
			throw new BadRequestException('Mỗi challenge chỉ kéo dài tối đa 2 tháng');
		}
	}

	private normalizeActivities(activities: CreateChallengeDto['activities']) {
		if (!activities.length) {
			throw new BadRequestException('Challenge phải có ít nhất một hoạt động');
		}
		if (activities.length > MAX_CHALLENGE_ACTIVITIES) {
			throw new BadRequestException(`Mỗi challenge tối đa ${MAX_CHALLENGE_ACTIVITIES} hoạt động trong ngày`);
		}

		const usedNames = new Set<string>();
		return activities.map((activity) => {
			const normalizedName = activity.name.trim();
			if (usedNames.has(normalizedName.toLowerCase())) {
				throw new BadRequestException('Tên hoạt động trong challenge không được trùng nhau');
			}
			usedNames.add(normalizedName.toLowerCase());

			const normalizedWindows = [...activity.timeWindows]
				.map((timeWindow) => {
					const startMinutes = this.toMinutes(timeWindow.startTime);
					const endMinutes = timeWindow.endTime ? this.toMinutes(timeWindow.endTime) : null;
					if (endMinutes !== null && startMinutes >= endMinutes) {
						throw new BadRequestException('endTime phải sau startTime');
					}

					return {
						startTime: timeWindow.startTime,
						endTime: timeWindow.endTime ?? null,
						startMinutes,
						endMinutes: endMinutes ?? startMinutes + 59,
					};
				})
				.sort((left, right) => left.startMinutes - right.startMinutes);

			for (let index = 1; index < normalizedWindows.length; index += 1) {
				if (normalizedWindows[index].startMinutes < normalizedWindows[index - 1].endMinutes) {
					throw new BadRequestException(`Các khung giờ của hoạt động ${normalizedName} đang bị chồng lên nhau`);
				}
			}

			return {
				name: normalizedName,
				timeWindows: normalizedWindows.map((timeWindow) => ({
					startTime: timeWindow.startTime,
					endTime: timeWindow.endTime,
				})),
			};
		});
	}

	private isInsideAnyTimeWindow(now: Date, timeWindows: ChallengeSchedule[]) {
		const currentMinutes = this.getVietnamCurrentMinutes(now);
		return timeWindows.some((timeWindow) => {
			const startMinutes = this.toMinutes(timeWindow.startTime);
			const endMinutes = timeWindow.endTime ? this.toMinutes(timeWindow.endTime) : startMinutes + 59;
			return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
		});
	}

	private isDateWithinChallenge(now: Date, challenge: Challenge) {
		const dateKey = this.toDateKey(now);
		return dateKey >= challenge.startsOn && dateKey <= challenge.endsOn;
	}

	private enumerateDateKeys(startsOn: string, endsOn: string) {
		const dates: string[] = [];
		const current = this.parseDateKey(startsOn);
		const end = this.parseDateKey(endsOn);
		while (current <= end) {
			dates.push(this.toUtcDateKey(current));
			current.setUTCDate(current.getUTCDate() + 1);
		}
		return dates;
	}

	private toMinutes(value: string) {
		const [hours, minutes] = value.split(':').map(Number);
		return hours * 60 + minutes;
	}

	private toDateKey(date: Date) {
		const vietnamDate = this.toVietnamDate(date);
		const year = vietnamDate.getUTCFullYear();
		const month = `${vietnamDate.getUTCMonth() + 1}`.padStart(2, '0');
		const day = `${vietnamDate.getUTCDate()}`.padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	private toChallengeCard(challenge: Challenge, currentUserId: string) {
		const activities = this.toActivitySummaries(challenge.activities, challenge);
		const memberCount = challenge.members.length;
		const pendingInviteCount = challenge.invites?.filter((item) => item.status === ChallengeInviteStatus.PENDING).length ?? 0;
		return {
			id: challenge.id,
			name: challenge.name,
			startsOn: challenge.startsOn,
			endsOn: challenge.endsOn,
			status: challenge.status,
			isHost: challenge.hostId === currentUserId,
			host: this.toUserSummary(challenge.host),
			memberCount,
			activityCount: activities.length,
			activities,
			pendingInviteCount,
			nextSessionLabel: activities.length
				? `${activities.length} hoạt động / ngày`
				: 'Chưa có hoạt động',
		};
	}

	private toInviteSummary(invite: ChallengeInvite) {
		return {
			id: invite.id,
			status: invite.status,
			createdAt: invite.createdAt,
			inviter: this.toUserSummary(invite.inviter),
			invitee: this.toUserSummary(invite.invitee),
			challenge: invite.challenge
				? {
					id: invite.challenge.id,
					name: invite.challenge.name,
					startsOn: invite.challenge.startsOn,
					endsOn: invite.challenge.endsOn,
					activityCount: invite.challenge.activities?.length ?? 0,
					memberCount: invite.challenge.members?.length ?? 0,
					activities: this.toActivitySummaries(invite.challenge.activities ?? [], invite.challenge),
				}
				: null,
		};
	}

	private toEvidenceSummary(evidence: ChallengeEvidence) {
		return {
			id: evidence.id,
			activity: evidence.activity ? this.toActivitySummary(evidence.activity) : null,
			sessionDate: evidence.sessionDate,
			mediaType: evidence.mediaType,
			mediaUrl: evidence.mediaUrl,
			caption: evidence.caption,
			durationSeconds: evidence.durationSeconds,
			createdAt: evidence.createdAt,
			user: evidence.user ? this.toUserSummary(evidence.user) : null,
		};
	}

	private toNotificationSummary(notification: ChallengeNotification) {
		return {
			id: notification.id,
			type: notification.type,
			title: notification.title,
			body: notification.body,
			metadata: notification.metadata,
			isRead: notification.isRead,
			createdAt: notification.createdAt,
			challengeId: notification.challengeId,
		};
	}

	private toActivitySummaries(activities: ChallengeActivity[], challenge?: Challenge) {
		return [...activities]
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((activity) => this.toActivitySummary(activity, challenge));
	}

	private toActivitySummary(activity: ChallengeActivity, challenge?: Challenge) {
		const now = new Date();
		const isActiveNow = (!challenge || this.isDateWithinChallenge(now, challenge))
			&& this.isInsideAnyTimeWindow(now, activity.timeWindows ?? []);
		const currentWindow = this.getCurrentWindow(now, activity.timeWindows ?? []);
		return {
			id: activity.id,
			name: activity.name,
			timeWindows: [...(activity.timeWindows ?? [])]
				.sort((left, right) => left.sortOrder - right.sortOrder)
				.map((timeWindow) => this.toTimeWindowSummary(timeWindow)),
			isActiveNow,
			activeWindowLabel: currentWindow ? this.toTimeWindowSummary(currentWindow).label : null,
			windowLabel: this.formatTimeWindowList(activity.timeWindows ?? []),
		};
	}

	private getCurrentWindow(now: Date, timeWindows: ChallengeSchedule[]) {
		const currentMinutes = this.getVietnamCurrentMinutes(now);
		return timeWindows.find((timeWindow) => {
			const startMinutes = this.toMinutes(timeWindow.startTime);
			const endMinutes = timeWindow.endTime ? this.toMinutes(timeWindow.endTime) : startMinutes + 59;
			return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
		}) ?? null;
	}

	private toTimeWindowSummary(timeWindow: ChallengeSchedule) {
		const label = timeWindow.endTime
			? `${timeWindow.startTime} - ${timeWindow.endTime}`
			: `${timeWindow.startTime}`;
		return {
			id: timeWindow.id,
			startTime: timeWindow.startTime,
			endTime: timeWindow.endTime,
			label,
		};
	}

	private formatTimeWindowList(timeWindows: ChallengeSchedule[]) {
		return [...timeWindows]
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((timeWindow) => this.toTimeWindowSummary(timeWindow).label)
			.join(' | ');
	}

	private formatClock(date: Date) {
		const vietnamDate = this.toVietnamDate(date);
		return `${`${vietnamDate.getUTCHours()}`.padStart(2, '0')}:${`${vietnamDate.getUTCMinutes()}`.padStart(2, '0')}`;
	}

	private formatDateLabel(dateKey: string) {
		const date = this.parseDateKey(dateKey);
		return date.toLocaleDateString('vi-VN', {
			timeZone: 'UTC',
			weekday: 'long',
			day: '2-digit',
			month: '2-digit',
		});
	}

	private parseDateKey(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(Date.UTC(year, month - 1, day));
	}

	private toUtcDateKey(date: Date) {
		return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
	}

	private toVietnamDate(date: Date) {
		return new Date(date.getTime() + VIETNAM_OFFSET_MS);
	}

	private getVietnamCurrentMinutes(date: Date) {
		const vietnamDate = this.toVietnamDate(date);
		return vietnamDate.getUTCHours() * 60 + vietnamDate.getUTCMinutes();
	}

	private toUserSummary(user: { id: string; email: string; username: string; avatarUrl?: string | null }) {
		return {
			id: user.id,
			email: user.email,
			username: user.username,
			avatarUrl: user.avatarUrl ?? null,
		};
	}
}