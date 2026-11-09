import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard (passerelle)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildContext = (
    headers: Record<string, string>,
    path = '/api/chambres',
  ): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request: any = { headers, path };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    };
  };

  const buildConfig = (values: Record<string, string>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  const SECRET = 'test-secret';
  const ISSUER = 'SmartCampus';

  const signedToken = (payload: object) =>
    jwt.sign(payload, SECRET, { issuer: ISSUER, algorithm: 'HS256' });

  const demoToken = (payload: object) => {
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '');
    return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.demo`;
  };

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as never;
  const devConfig = buildConfig({
    JWT_SECRET: SECRET,
    JWT_ISSUER: ISSUER,
    AUTH_ACCEPT_DEMO_TOKEN: 'true',
  });
  const prodConfig = buildConfig({
    JWT_SECRET: SECRET,
    JWT_ISSUER: ISSUER,
    AUTH_ACCEPT_DEMO_TOKEN: 'false',
  });

  it('accepte un JWT HS256 valide et peuple request.user', () => {
    const guard = new JwtAuthGuard(reflector, devConfig);
    const ctx = buildContext({
      authorization: `Bearer ${signedToken({ sub: 'ETU-2024-0187', name: 'Yasmine', role: 'student' })}`,
    });

    expect(guard.canActivate(ctx as never)).toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect(req.user).toEqual({
      userId: 'ETU-2024-0187',
      name: 'Yasmine',
      role: 'student',
    });
  });

  it('rejette sans en-tete Authorization (401)', () => {
    const guard = new JwtAuthGuard(reflector, devConfig);
    expect(() => guard.canActivate(buildContext({}) as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('accepte le jeton de demonstration non signe en mode dev', () => {
    const guard = new JwtAuthGuard(reflector, devConfig);
    const ctx = buildContext({
      authorization: `Bearer ${demoToken({ sub: 'ADM-0001', name: 'Sonia', role: 'admin' })}`,
    });

    expect(guard.canActivate(ctx as never)).toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect(req.user).toEqual({
      userId: 'ADM-0001',
      name: 'Sonia',
      role: 'admin',
    });
  });

  it('rejette le jeton de demonstration quand AUTH_ACCEPT_DEMO_TOKEN=false', () => {
    const guard = new JwtAuthGuard(reflector, prodConfig);
    expect(() =>
      guard.canActivate(
        buildContext({
          authorization: `Bearer ${demoToken({ sub: 'ADM-0001', role: 'admin' })}`,
        }) as never,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejette un jeton signe avec le mauvais secret (401)', () => {
    const guard = new JwtAuthGuard(reflector, devConfig);
    const wrong = jwt.sign({ sub: 'x', role: 'admin' }, 'autre-secret', {
      issuer: ISSUER,
    });
    expect(() =>
      guard.canActivate(
        buildContext({ authorization: `Bearer ${wrong}` }) as never,
      ),
    ).toThrow(UnauthorizedException);
  });

  describe('session par cookie httpOnly (sc_access)', () => {
    const user = { sub: 'ETU-2026-0002', name: 'Farah', role: 'student' };
    const cookieCtx = (
      method: string,
      extra: Record<string, string> = {},
      token = signedToken(user),
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request: any = {
        method,
        path: '/api/demandes',
        headers: { cookie: `autre=1; sc_access=${token}; x=2`, ...extra },
      };
      return {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => undefined,
        getClass: () => undefined,
      };
    };
    const cookieConfig = buildConfig({
      JWT_SECRET: SECRET,
      JWT_ISSUER: ISSUER,
      CORS_ORIGINS: 'http://localhost:5173',
    });

    it('accepte une lecture authentifiee par cookie', () => {
      const guard = new JwtAuthGuard(reflector, cookieConfig);
      const ctx = cookieCtx('GET');
      expect(guard.canActivate(ctx as never)).toBe(true);
      expect(ctx.switchToHttp().getRequest().user.userId).toBe('ETU-2026-0002');
    });

    it('accepte une ecriture par cookie avec X-Auth-Mode et origine autorisee', () => {
      const guard = new JwtAuthGuard(reflector, cookieConfig);
      const ctx = cookieCtx('POST', {
        'x-auth-mode': 'cookie',
        origin: 'http://localhost:5173',
      });
      expect(guard.canActivate(ctx as never)).toBe(true);
    });

    it('refuse une ecriture par cookie sans X-Auth-Mode (CSRF)', () => {
      const guard = new JwtAuthGuard(reflector, cookieConfig);
      expect(() =>
        guard.canActivate(
          cookieCtx('POST', { origin: 'http://localhost:5173' }) as never,
        ),
      ).toThrow(ForbiddenException);
    });

    it('refuse une ecriture par cookie depuis une origine etrangere (CSRF)', () => {
      const guard = new JwtAuthGuard(reflector, cookieConfig);
      expect(() =>
        guard.canActivate(
          cookieCtx('DELETE', {
            'x-auth-mode': 'cookie',
            origin: 'https://pirate.example',
          }) as never,
        ),
      ).toThrow(ForbiddenException);
    });

    it('rejette un cookie dont le jeton est invalide (401)', () => {
      const guard = new JwtAuthGuard(reflector, cookieConfig);
      expect(() =>
        guard.canActivate(cookieCtx('GET', {}, 'pas.un.jwt') as never),
      ).toThrow(UnauthorizedException);
    });

    it('un jeton Bearer reste accepte en ecriture sans en-tete CSRF', () => {
      const guard = new JwtAuthGuard(reflector, cookieConfig);
      const ctx = buildContext({
        authorization: `Bearer ${signedToken(user)}`,
      });
      ctx.switchToHttp().getRequest().method = 'POST';
      expect(guard.canActivate(ctx as never)).toBe(true);
    });
  });

  it('laisse passer la documentation Swagger sans jeton', () => {
    const guard = new JwtAuthGuard(reflector, devConfig);
    expect(guard.canActivate(buildContext({}, '/api/docs') as never)).toBe(
      true,
    );
  });
});
