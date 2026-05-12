import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { env } from '../src/config/env';
import { TalentController } from '../src/modules/talent/talent.controller';
import { TalentService } from '../src/modules/talent/talent.service';
import {
  TalentProfile,
  TalentProfileStatus,
} from '../src/modules/talent/entities/talent-profile.entity';
import { EmployerController } from '../src/modules/employer/employer.controller';
import { EmployerService } from '../src/modules/employer/employer.service';
import { EmployerProfile } from '../src/modules/employer/entities/employer-profile.entity';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../src/modules/auth/auth.cookies';
import { AuthService } from '../src/modules/auth/auth.service';
import { PasswordResetOtp } from '../src/modules/auth/entities/password-reset-otp.entity';
import { PasswordResetOtpService } from '../src/modules/auth/password-reset-otp.service';
import { PasswordResetQueueService } from '../src/modules/auth/password-reset-queue.service';
import { VerificationOtpService } from '../src/modules/auth/verification-otp.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { MailService } from '../src/modules/mail/mail.service';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { UsersService } from '../src/modules/users/users.service';

type TalentUser = User & { role: UserRole.TALENT };
type EmployerUser = User & { role: UserRole.EMPLOYER };

class InMemoryUsersService {
  private readonly usersById = new Map<string, User>();

  constructor() {
    this.seedUser({
      id: 'talent-user',
      email: 'talent@example.com',
      first_name: 'Casey',
      last_name: 'Talent',
      country: 'Nigeria',
      role: UserRole.TALENT,
    });
    this.seedUser({
      id: 'employer-user',
      email: 'employer@example.com',
      first_name: 'Efe',
      last_name: 'Employer',
      country: 'Nigeria',
      role: UserRole.EMPLOYER,
    });
  }

  private seedUser(input: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    country: string;
    role: UserRole;
  }): void {
    const user = Object.assign(new User(), {
      ...input,
      password: null,
      avatar_url: null,
      is_verified: true,
      onboarding_complete: false,
      refreshTokenHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.usersById.set(user.id, user);
  }

  async findOne(id: string): Promise<User> {
    const user = this.usersById.get(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  findOneOrNull(id: string): Promise<User | null> {
    return Promise.resolve(this.usersById.get(id) ?? null);
  }

  async markOnboardingComplete(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.onboarding_complete = true;
    return user;
  }

  async getUserForOnboarding(_manager: unknown, id: string): Promise<User> {
    return this.findOne(id);
  }

  async markOnboardingCompleteWithManager(
    _manager: unknown,
    id: string,
  ): Promise<void> {
    await this.markOnboardingComplete(id);
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    const user = await this.findOne(id);
    user.refreshTokenHash = hash;
  }
}

class InMemoryTalentProfileRepository {
  private readonly profiles = new Map<string, TalentProfile>();
  private nextId = 1;
  readonly manager: {
    transaction: <T>(
      callback: (manager: {
        findOne: <Entity>(
          entity: new () => Entity,
          options: { where: { id?: string; user_id?: string } },
        ) => Promise<Entity | null>;
        create: <Entity>(
          entity: new () => Entity,
          payload: Partial<Entity>,
        ) => Entity;
        save: <Entity>(
          entity: new () => Entity,
          payload: Entity,
        ) => Promise<Entity>;
        update: <Entity>(
          entity: new () => Entity,
          criteria: { id: string },
          partial: Partial<Entity>,
        ) => Promise<void>;
      }) => Promise<T>,
    ) => Promise<T>;
  };

  constructor(private readonly usersService: InMemoryUsersService) {
    this.manager = {
      transaction: async (callback) =>
        callback({
          findOne: async <Entity>(
            entity: new () => Entity,
            options: { where: { id?: string; user_id?: string } },
          ): Promise<Entity | null> => {
            if (entity === (User as unknown as new () => Entity)) {
              const id = options.where.id;
              return id
                ? ((await this.usersService.findOneOrNull(id)) as Entity | null)
                : null;
            }
            const userId = options.where.user_id;
            return userId
              ? ((this.profiles.get(userId) ?? null) as Entity | null)
              : null;
          },
          create: <Entity>(
            _entity: new () => Entity,
            payload: Partial<Entity>,
          ): Entity => Object.assign(new TalentProfile(), payload) as Entity,
          save: async <Entity>(
            _entity: new () => Entity,
            payload: Entity,
          ): Promise<Entity> =>
            this.save(payload as TalentProfile) as Promise<Entity>,
          update: async <Entity>(
            entity: new () => Entity,
            criteria: { id: string },
            partial: Partial<Entity>,
          ): Promise<void> => {
            if (entity === (User as unknown as new () => Entity)) {
              const user = await this.usersService.findOne(criteria.id);
              Object.assign(user, partial);
            }
          },
        }),
    };
  }

  create(payload: Partial<TalentProfile>): TalentProfile {
    return Object.assign(new TalentProfile(), payload);
  }

  async save(profile: TalentProfile): Promise<TalentProfile> {
    const nextProfile = profile.id
      ? profile
      : Object.assign(profile, {
          id: `talent-profile-${this.nextId++}`,
          created_at: new Date(),
          updated_at: new Date(),
        });
    this.profiles.set(nextProfile.user_id, nextProfile);
    return nextProfile;
  }

  findOne(options: {
    where: { user_id: string };
  }): Promise<TalentProfile | null> {
    return Promise.resolve(this.profiles.get(options.where.user_id) ?? null);
  }
}

class InMemoryEmployerProfileRepository {
  private readonly profiles = new Map<string, EmployerProfile>();
  private nextId = 1;
  readonly manager: {
    transaction: <T>(
      callback: (manager: {
        findOne: <Entity>(
          entity: new () => Entity,
          options: { where: { id?: string; user_id?: string } },
        ) => Promise<Entity | null>;
        create: <Entity>(
          entity: new () => Entity,
          payload: Partial<Entity>,
        ) => Entity;
        save: <Entity>(
          entity: new () => Entity,
          payload: Entity,
        ) => Promise<Entity>;
        update: <Entity>(
          entity: new () => Entity,
          criteria: { id: string },
          partial: Partial<Entity>,
        ) => Promise<void>;
      }) => Promise<T>,
    ) => Promise<T>;
  };

  constructor(private readonly usersService: InMemoryUsersService) {
    this.manager = {
      transaction: async (callback) =>
        callback({
          findOne: async <Entity>(
            entity: new () => Entity,
            options: { where: { id?: string; user_id?: string } },
          ): Promise<Entity | null> => {
            if (entity === (User as unknown as new () => Entity)) {
              const id = options.where.id;
              return id
                ? ((await this.usersService.findOneOrNull(id)) as Entity | null)
                : null;
            }
            const userId = options.where.user_id;
            return userId
              ? ((this.profiles.get(userId) ?? null) as Entity | null)
              : null;
          },
          create: <Entity>(
            _entity: new () => Entity,
            payload: Partial<Entity>,
          ): Entity => Object.assign(new EmployerProfile(), payload) as Entity,
          save: async <Entity>(
            _entity: new () => Entity,
            payload: Entity,
          ): Promise<Entity> =>
            this.save(payload as EmployerProfile) as Promise<Entity>,
          update: async <Entity>(
            entity: new () => Entity,
            criteria: { id: string },
            partial: Partial<Entity>,
          ): Promise<void> => {
            if (entity === (User as unknown as new () => Entity)) {
              const user = await this.usersService.findOne(criteria.id);
              Object.assign(user, partial);
            }
          },
        }),
    };
  }

  create(payload: Partial<EmployerProfile>): EmployerProfile {
    return Object.assign(new EmployerProfile(), payload);
  }

  async save(profile: EmployerProfile): Promise<EmployerProfile> {
    const nextProfile = profile.id
      ? profile
      : Object.assign(profile, {
          id: `employer-profile-${this.nextId++}`,
          created_at: new Date(),
          updated_at: new Date(),
        });
    this.profiles.set(nextProfile.user_id, nextProfile);
    return nextProfile;
  }

  findOne(options: {
    where: { user_id: string };
  }): Promise<EmployerProfile | null> {
    return Promise.resolve(this.profiles.get(options.where.user_id) ?? null);
  }
}

class StubVerificationOtpService {}

class StubMailService {}

const getSetCookies = (response: {
  headers: Record<string, string | string[] | undefined>;
}): string[] => {
  const header = response.headers['set-cookie'];
  if (Array.isArray(header)) {
    return header;
  }
  return typeof header === 'string' ? [header] : [];
};

const findCookie = (cookies: string[], name: string): string =>
  cookies.find((cookie) => cookie.startsWith(`${name}=`)) ?? '';

const accessCookieHeaderFor = async (
  jwtService: JwtService,
  user: User,
): Promise<string> => {
  const accessToken = await jwtService.signAsync(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      onboardingComplete: user.onboarding_complete,
    },
    {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue,
    },
  );

  return `${ACCESS_TOKEN_COOKIE}=${accessToken}`;
};

describe('Onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: InMemoryUsersService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: env.JWT_ACCESS_SECRET }),
      ],
      controllers: [TalentController, EmployerController],
      providers: [
        TalentService,
        EmployerService,
        AuthService,
        JwtStrategy,
        { provide: UsersService, useClass: InMemoryUsersService },
        {
          provide: getRepositoryToken(TalentProfile),
          useFactory: (inMemoryUsersService: InMemoryUsersService) =>
            new InMemoryTalentProfileRepository(inMemoryUsersService),
          inject: [UsersService],
        },
        {
          provide: getRepositoryToken(EmployerProfile),
          useFactory: (inMemoryUsersService: InMemoryUsersService) =>
            new InMemoryEmployerProfileRepository(inMemoryUsersService),
          inject: [UsersService],
        },
        {
          provide: VerificationOtpService,
          useClass: StubVerificationOtpService,
        },
        { provide: MailService, useClass: StubMailService },
        {
          provide: PasswordResetOtpService,
          useValue: {
            issue: jest
              .fn()
              .mockResolvedValue({ code: '123456', expiresAt: new Date() }),
            consume: jest.fn().mockResolvedValue(true),
            countRecentResends: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: getRepositoryToken(PasswordResetOtp),
          useValue: {},
        },
        {
          provide: PasswordResetQueueService,
          useValue: {
            enqueue: jest.fn(),
            awaitIdleForTests: jest.fn().mockResolvedValue(undefined),
            onModuleDestroy: jest.fn(),
            onModuleInit: jest.fn(),
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();

    usersService = moduleFixture.get(UsersService);
    jwtService = moduleFixture.get(JwtService);
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('POST /talent/onboarding completes talent onboarding and reissues auth cookies', async () => {
    const user = (await usersService.findOne('talent-user')) as TalentUser;
    const cookieHeader = await accessCookieHeaderFor(jwtService, user);

    const response = await request(app.getHttpServer())
      .post('/talent/onboarding')
      .set('Cookie', cookieHeader)
      .send({
        roleTrack: 'frontend',
        bio: 'Entry-level frontend engineer focused on accessible web apps.',
      })
      .expect(200);

    const cookies = getSetCookies(response);
    expect(findCookie(cookies, ACCESS_TOKEN_COOKIE)).toContain('HttpOnly');
    expect(findCookie(cookies, REFRESH_TOKEN_COOKIE)).toContain('HttpOnly');
    expect(response.body).toMatchObject({
      status_code: 200,
      message: 'Talent onboarding completed',
      user: {
        role: UserRole.TALENT,
        onboardingComplete: true,
      },
      profile: {
        user_id: user.id,
        role_track: 'frontend',
        status: TalentProfileStatus.NOT_STARTED,
      },
    });

    const updatedUser = await usersService.findOne(user.id);
    expect(updatedUser.onboarding_complete).toBe(true);
  });

  it('POST /talent/onboarding rejects repeated completion', async () => {
    const user = (await usersService.findOne('talent-user')) as TalentUser;
    const cookieHeader = await accessCookieHeaderFor(jwtService, user);

    await request(app.getHttpServer())
      .post('/talent/onboarding')
      .set('Cookie', cookieHeader)
      .send({ roleTrack: 'frontend' })
      .expect(200);

    const secondAccessCookie = await accessCookieHeaderFor(
      jwtService,
      await usersService.findOne(user.id),
    );

    await request(app.getHttpServer())
      .post('/talent/onboarding')
      .set('Cookie', secondAccessCookie)
      .send({ roleTrack: 'frontend' })
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({
          success: false,
          status_code: 403,
          message: 'Onboarding already completed',
        });
      });
  });

  it('POST /employer/onboarding completes employer onboarding', async () => {
    const user = (await usersService.findOne('employer-user')) as EmployerUser;
    const cookieHeader = await accessCookieHeaderFor(jwtService, user);

    const response = await request(app.getHttpServer())
      .post('/employer/onboarding')
      .set('Cookie', cookieHeader)
      .send({
        companyName: 'Acme Labs',
        companySize: '11-50',
        industry: 'Technology',
        websiteUrl: 'https://acmelabs.example',
        hiringRegion: 'Remote, Africa',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      status_code: 200,
      message: 'Employer onboarding completed',
      user: {
        role: UserRole.EMPLOYER,
        onboardingComplete: true,
      },
      profile: {
        user_id: user.id,
        company_name: 'Acme Labs',
        company_size: '11-50',
        industry: 'Technology',
        website_url: 'https://acmelabs.example',
        hiring_region: 'Remote, Africa',
      },
    });
  });

  it('POST /employer/onboarding rejects the wrong role', async () => {
    const talentUser = (await usersService.findOne(
      'talent-user',
    )) as TalentUser;
    const cookieHeader = await accessCookieHeaderFor(jwtService, talentUser);

    await request(app.getHttpServer())
      .post('/employer/onboarding')
      .set('Cookie', cookieHeader)
      .send({ companyName: 'Acme Labs' })
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({
          success: false,
          status_code: 403,
          message: 'Insufficient permissions',
        });
      });
  });
});
