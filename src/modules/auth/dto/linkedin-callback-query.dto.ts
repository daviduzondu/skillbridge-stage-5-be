import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LinkedInCallbackQueryDto {
  @ApiPropertyOptional({
    description:
      'Authorization code (missing if the user cancelled or the provider returned an error).',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description:
      'CSRF state; must match the `linkedin_oauth_state` cookie from GET /auth/linkedin.',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description:
      'OAuth error code from the provider when consent failed or was denied.',
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({
    description:
      'Human-readable error detail from the provider (OAuth 2); ignored by the handler.',
  })
  @IsOptional()
  @IsString()
  error_description?: string;
}
