import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { CandidateProfile } from './entities/candidate-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CandidateProfile]),
    UsersModule,
    AuthModule,
  ],
  controllers: [CandidateController],
  providers: [CandidateService],
})
export class CandidateModule {}
