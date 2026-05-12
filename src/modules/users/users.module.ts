import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModelAction } from './actions/user.action';
import { OAuthUserModelAction } from './actions/user-oauth.action';
import { User } from './entities/user.entity';
import { OAuthUser } from './entities/user-oauth.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, OAuthUser])],
  controllers: [UsersController],
  providers: [UserModelAction, OAuthUserModelAction, UsersService],
  exports: [UsersService, UserModelAction],
})
export class UsersModule {}
