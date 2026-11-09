export const DEV_INTERNAL_KEY = 'dev-internal-key-change-me';

/**
 * Cle partagee avec les microservices internes (en-tete X-Internal-Key). Identique a celle lue par leur garde ;
 * obligatoire en production.
 */
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
