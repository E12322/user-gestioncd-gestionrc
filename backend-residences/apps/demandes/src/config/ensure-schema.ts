import * as path from 'path';
import { config } from 'dotenv';
import { Client } from 'pg';

/** Charge le .env local de l'app puis celui de la racine du workspace. */
export function loadEnvFiles(): void {
  config({ path: path.resolve(process.cwd(), '.env') });
  config({ path: path.resolve(process.cwd(), '../../.env') });
}

/**
 * Assure l'existence du schema dedie du service avant la synchronisation
 * TypeORM (TypeORM ne cree pas les schemas automatiquement).
 */
export async function ensureSchemaExists(schema: string): Promise<void> {
  const host = process.env.DB_HOST ?? 'localhost';
  const port = parseInt(process.env.DB_PORT ?? '5432', 10);
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? 'postgres';
  const database = process.env.DB_NAME ?? 'smartcampus';

  const client = new Client({ host, port, user, password, database });

  try {
    await client.connect();
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[ensureSchemaExists] Impossible de creer le schema "${schema}" : ${message}`,
    );
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}
