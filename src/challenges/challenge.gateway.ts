import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

type SocketWithUser = Socket & {
	data: {
		userId?: string;
	};
};

@WebSocketGateway({
	cors: {
		origin: '*',
	},
	namespace: '/challenges',
})
export class ChallengeGateway implements OnGatewayConnection {
	@WebSocketServer()
	server: Server;

	private readonly logger = new Logger(ChallengeGateway.name);

	constructor(private readonly jwtService: JwtService) { }

	handleConnection(client: SocketWithUser) {
		const rawToken = this.getToken(client);
		if (!rawToken) {
			client.disconnect();
			return;
		}

		try {
			const payload = this.jwtService.verify(rawToken);
			client.data.userId = payload.sub;
			client.join(this.getUserRoom(payload.sub));
		} catch (error) {
			this.logger.warn(`Challenge socket rejected: ${error instanceof Error ? error.message : 'unknown error'}`);
			client.disconnect();
		}
	}

	@SubscribeMessage('challenge.join')
	handleJoinChallenge(
		@ConnectedSocket() client: SocketWithUser,
		@MessageBody() payload: { challengeId?: string },
	) {
		if (!payload?.challengeId || !client.data.userId) {
			return;
		}

		client.join(this.getChallengeRoom(payload.challengeId));
	}

	emitToUsers(userIds: string[], event: string, payload: unknown) {
		for (const userId of new Set(userIds)) {
			this.server.to(this.getUserRoom(userId)).emit(event, payload);
		}
	}

	emitChallengeUpdate(challengeId: string, payload: unknown) {
		this.server.to(this.getChallengeRoom(challengeId)).emit('challenge.updated', payload);
	}

	private getToken(client: Socket) {
		const authorizationHeader = client.handshake.headers.authorization;
		if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
			return authorizationHeader.slice(7);
		}

		if (typeof client.handshake.auth?.token === 'string') {
			return client.handshake.auth.token;
		}

		return null;
	}

	private getUserRoom(userId: string) {
		return `user:${userId}`;
	}

	private getChallengeRoom(challengeId: string) {
		return `challenge:${challengeId}`;
	}
}