import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength } from 'class-validator';

export class EnableTotp2faDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code from authenticator app',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class DisableTotp2faDto {
  @ApiProperty({
    example: 'password123',
    description: 'User password to confirm disable',
  })
  @IsString()
  @MinLength(1)
  password: string;
}

export class VerifyMfa {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code from authenticator app',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class VerifyRecoveryCode {
  @ApiProperty({
    example: 'A1B2-C3D4',
    description: 'Recovery code',
  })
  @IsString()
  @Length(9, 9)
  code: string;
}

export class RegenerateRecoveryCodesDto {
  @ApiProperty({
    example: 'password123',
    description: 'User password to authorize regeneration',
  })
  @IsString()
  @MinLength(1)
  password: string;
}
