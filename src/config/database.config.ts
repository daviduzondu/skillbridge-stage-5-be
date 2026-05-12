import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { env } from './env';

const sslConfig =
  process.env.DATABASE_SSL === 'true'
    ? {
        rejectUnauthorized: false,
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
