import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { EmployerController } from './employer.controller';
import { EmployerService } from './employer.service';
import { EmployerProfile } from './entities/employer-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployerProfile]),
    UsersModule,
    AuthModule,
  ],
  controllers: [EmployerController],
  providers: [EmployerService],
})
export class EmployerModule {}
