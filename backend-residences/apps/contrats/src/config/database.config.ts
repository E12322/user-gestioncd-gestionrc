import { registerAs } from '@nestjs/config';

/** Configuration PostgreSQL du service Contrats (schema dedie). */
export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'smartcampus',
  schema: process.env.DB_CONTRATS_SCHEMA ?? 'BDD_Contrats',
  synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
  logging: (process.env.DB_LOGGING ?? 'false') === 'true',
}));
