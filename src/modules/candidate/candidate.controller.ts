import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { setAuthCookies } from '../auth/auth.cookies';
import { UserRole } from '../users/entities/user.entity';
import { CandidateService } from './candidate.service';
import { CompleteCandidateOnboardingDto } from './dto/complete-candidate-onboarding.dto';

@ApiTags('candidate')
@ApiCookieAuth()
@Controller('candidate')
@Roles(UserRole.TALENT)
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete candidate onboarding' })
  @ApiForbiddenResponse({ description: 'Onboarding already completed' })
  async completeOnboarding(
    @CurrentUser('sub') userId: string,
    @Body() dto: CompleteCandidateOnboardingDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.candidateService.completeOnboarding(userId, dto);
    setAuthCookies(response, result.tokens);
    return {
      message: result.message,
      user: result.user,
      profile: result.profile,
    };
  }
}
