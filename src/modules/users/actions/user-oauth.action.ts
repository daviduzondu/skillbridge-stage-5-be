import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthUser } from '../entities/user-oauth.entity';

@Injectable()
export class OAuthUserModelAction extends AbstractModelAction<OAuthUser> {
  constructor(
    @InjectRepository(OAuthUser)
    protected readonly repository: Repository<OAuthUser>,
  ) {
    super(repository, OAuthUser);
  }

  async findOAuthUser(
    provider: string,
    provider_id: string,
  ): Promise<OAuthUser | null> {
    return this.repository.findOne({
      where: { provider, provider_id },
      relations: ['user'],
    });
  }

  async insertOAuthUser(
    user_id: string,
    provider: string,
    provider_id: string,
  ): Promise<OAuthUser> {
    const oauthUser = this.repository.create({
      user_id,
      provider,
      provider_id,
    });
    return this.repository.save(oauthUser);
  }
}
