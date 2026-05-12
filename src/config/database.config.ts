import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { env } from './env';

const sslConfig = env.DATABASE_SSL
  ? {
      ca: env.DATABASE_SSL_CA,
      rejectUnauthorized: true,
    }
  : false;

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: env.DATABASE_SYNC,
    logging: env.DATABASE_LOGGING,
    ssl: sslConfig,
    autoLoadEntities: true,
  }),
);
