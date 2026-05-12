import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from '../config/env';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  username: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: env.DATABASE_LOGGING,
  ssl: env.DATABASE_SSL
    ? { ca: env.DATABASE_SSL_CA, rejectUnauthorized: true }
    : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
