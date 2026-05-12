import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const JOINING_AS = ['talent', 'employer'] as const;

export class JoinWaitlistDto {
  @ApiProperty({ enum: JOINING_AS, example: 'talent' })
  @IsIn(JOINING_AS)
  joiningAs: (typeof JOINING_AS)[number];

  @ApiProperty({ example: 'Alex Okonkwo' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Frontend Developer' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  preferredRole?: string;

  @ApiPropertyOptional({ example: 'Facebook' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referralSource?: string;
}
