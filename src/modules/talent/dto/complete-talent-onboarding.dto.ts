import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CompleteTalentOnboardingDto {
  @ApiProperty({ example: 'frontend' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/\S/, { message: 'roleTrack must not be empty' })
  roleTrack: string;

  @ApiPropertyOptional({
    example: 'Entry-level frontend engineer focused on accessible web apps.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}
