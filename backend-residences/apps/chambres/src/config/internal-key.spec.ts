import {
  DEV_INTERNAL_KEY,
  internalKeyMiddleware,
  resolveInternalKey,
} from './internal-key';

describe('garde API interne (X-Internal-Key)', () => {
  const run = (key: string, headers: Record<string, string>, path = '/api/x') => {
    let status = 0;
    let passed = false;
    internalKeyMiddleware(key)(
      { path, headers },
      { status: (c: number) => ((status = c), { json: () => undefined }) },
      () => (passed = true),
    );
    return { status, passed };
  };

  it('laisse passer la passerelle (bonne cle)', () => {
    expect(run('secret-interne', { 'x-internal-key': 'secret-interne' }).passed).toBe(true);
  });

  it('refuse sans cle et avec une mauvaise cle (401)', () => {
    expect(run('secret-interne', {})).toEqual({ status: 401, passed: false });
    expect(run('secret-interne', { 'x-internal-key': 'autre' })).toEqual({ status: 401, passed: false });
  });

  it('ignore les en-tetes d identite forges', () => {
    const r = run('secret-interne', { 'x-user-id': 'PIRATE', 'x-role': 'admin' });
    expect(r).toEqual({ status: 401, passed: false });
  });

  it('laisse la documentation Swagger accessible', () => {
    expect(run('k', {}, '/api/docs').passed).toBe(true);
  });

  it('cle de dev hors production, obligatoire en production', () => {
    expect(resolveInternalKey({})).toBe(DEV_INTERNAL_KEY);
    expect(() => resolveInternalKey({ NODE_ENV: 'production' })).toThrow();
    expect(resolveInternalKey({ NODE_ENV: 'production', INTERNAL_API_KEY: 'abc' })).toBe('abc');
  });
});
