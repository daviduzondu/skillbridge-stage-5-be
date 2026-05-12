import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { env } from './env';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js,.cjs}')],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*{.ts,.js,.cjs}')],
    synchronize: env.DATABASE_SYNC,
    logging: env.DATABASE_LOGGING,
    ssl: sslConfig,
    autoLoadEntities: true,
  }),
);
