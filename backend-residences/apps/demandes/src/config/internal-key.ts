import { timingSafeEqual } from 'crypto';

/**
 * Garde « API interne » : ce microservice n'est PAS fait pour être appelé par un navigateur ni par un autre client que
 * la passerelle. Avant ce garde, il répondait à n'importe qui (données des étudiants comprises) et faisait confiance aux
 * en-têtes X-User-Id / X-Role, que tout le monde peut forger.
 *
 * La passerelle prouve son identité avec l'en-tête X-Internal-Key (secret partagé INTERNAL_API_KEY, comparé en temps
 * constant). En production, INTERNAL_API_KEY est obligatoire.
 */
export const DEV_INTERNAL_KEY = 'dev-internal-key-change-me';

export function resolveInternalKey(
  env: Record<string, string | undefined> = process.env,
): string {
  const key = env.INTERNAL_API_KEY;
  if (!key) {
    if (env.NODE_ENV === 'production') {
      throw new Error('INTERNAL_API_KEY est obligatoire en production');
    }
    return DEV_INTERNAL_KEY;
  }
  return key;
}

interface Req {
  path: string;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): { json(body: unknown): void };
}

export function internalKeyMiddleware(key: string) {
  const expected = Buffer.from(key);
  return (req: Req, res: Res, next: () => void): void => {
    if (req.path.startsWith('/api/docs')) return next();
    const provided = Buffer.from(String(req.headers['x-internal-key'] ?? ''));
    if (
      provided.length === expected.length &&
      timingSafeEqual(provided, expected)
    ) {
      return next();
    }
    res.status(401).json({ message: 'Acces reserve a la passerelle' });
  };
}
