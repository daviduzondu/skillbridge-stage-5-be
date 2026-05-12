import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CompleteEmployerOnboardingDto {
  @ApiProperty({ example: 'Acme Labs' })
  @IsString()
  @MaxLength(255)
  @Matches(/\S/, { message: 'companyName must not be empty' })
  companyName: string;

  @ApiPropertyOptional({ example: '11-50' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companySize?: string;

  @ApiPropertyOptional({ example: 'Technology' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ example: 'https://acmelabs.example' })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  websiteUrl?: string;

  @ApiPropertyOptional({
    example: 'We hire early-career engineers across product teams.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  companyDescription?: string;

  @ApiPropertyOptional({ example: 'Remote, Africa' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hiringRegion?: string;
}
