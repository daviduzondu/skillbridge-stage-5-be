import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { TalentProfile } from './entities/talent-profile.entity';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';

@Module({
  imports: [TypeOrmModule.forFeature([TalentProfile]), UsersModule, AuthModule],
  controllers: [TalentController],
  providers: [TalentService],
})
export class TalentModule {}
