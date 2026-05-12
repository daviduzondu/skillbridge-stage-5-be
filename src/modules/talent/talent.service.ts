import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthResult, AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { CompleteTalentOnboardingDto } from './dto/complete-talent-onboarding.dto';
import {
  TalentProfile,
  TalentProfileStatus,
} from './entities/talent-profile.entity';
import {
  ConflictError,
  ErrorMessages,
  ForbiddenError,
  SuccessMessages,
} from '../../shared';

export type TalentOnboardingResult = {
  message: string;
  user: AuthResult['data']['user'];
  profile: TalentProfile;
  tokens: AuthResult['tokens'];
};

@Injectable()
export class TalentService {
  constructor(
    @InjectRepository(TalentProfile)
    private readonly talentProfileRepository: Repository<TalentProfile>,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async completeOnboarding(
    userId: string,
    dto: CompleteTalentOnboardingDto,
  ): Promise<TalentOnboardingResult> {
    const profile = await this.talentProfileRepository.manager.transaction(
      async (manager) => {
        let user;
        try {
          user = await this.usersService.getUserForOnboarding(manager, userId);
        } catch (error: unknown) {
          if (error instanceof NotFoundException) {
            throw new ForbiddenError(ErrorMessages.ONBOARDING.INVALID_USER);
          }
          throw error;
        }
        if (user.onboarding_complete) {
          throw new ForbiddenError(ErrorMessages.ONBOARDING.ALREADY_COMPLETED);
        }

        const existingProfile = await manager.findOne(TalentProfile, {
          where: { user_id: userId },
        });
        if (existingProfile) {
          throw new ConflictError(ErrorMessages.ONBOARDING.TALENT_PROFILE_EXISTS);
        }

        const nextProfile = manager.create(TalentProfile, {
          user_id: userId,
          role_track: dto.roleTrack.trim(),
          bio: dto.bio?.trim() || null,
          status: TalentProfileStatus.NOT_STARTED,
          profile_share_link: null,
          is_published: false,
          published_at: null,
        });

        const savedProfile = await manager.save(TalentProfile, nextProfile);
        await this.usersService.markOnboardingCompleteWithManager(
          manager,
          userId,
        );

        return savedProfile;
      },
    );

    const session = await this.authService.issueSessionForUser(
      userId,
      SuccessMessages.ONBOARDING.TALENT_COMPLETED,
    );

    return {
      message: session.message,
      user: session.data.user,
      profile,
      tokens: session.tokens,
    };
  }
}
