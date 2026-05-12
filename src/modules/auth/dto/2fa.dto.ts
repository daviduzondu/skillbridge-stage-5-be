import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

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
    example: '123456',
    description: '6-digit TOTP code to confirm disable',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class Verify2fa {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code' })
  @IsString()
  @Length(6, 6)
  code: string;
}
