import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { UsersModule } from '../users/users.module';
import { ChallengeActivity } from './challenge-activity.entity';
import { ChallengeEvidence } from './challenge-evidence.entity';
import { ChallengeGateway } from './challenge.gateway';
import { ChallengeInvite } from './challenge-invite.entity';
import { ChallengeMember } from './challenge-member.entity';
import { ChallengeNotification } from './challenge-notification.entity';
import { ChallengeSchedule } from './challenge-schedule.entity';
import { Challenge } from './challenge.entity';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Challenge,
			ChallengeActivity,
			ChallengeMember,
			ChallengeSchedule,
			ChallengeInvite,
			ChallengeEvidence,
			ChallengeNotification,
		]),
		AuthModule,
		FriendsModule,
		UsersModule,
	],
	controllers: [ChallengesController],
	providers: [ChallengesService, ChallengeGateway],
	exports: [ChallengesService],
})
export class ChallengesModule { }