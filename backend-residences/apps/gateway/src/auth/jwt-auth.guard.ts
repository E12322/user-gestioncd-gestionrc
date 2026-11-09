import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

/** Cookie `httpOnly` pose par le service Utilisateurs (session du navigateur). */
const ACCESS_COOKIE = 'sc_access';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Lit un cookie dans l'en-tete `Cookie` (la passerelle n'embarque pas cookie-parser). */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      const raw = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw) || undefined;
      } catch {
        return raw || undefined;
      }
    }
  }
  return undefined;
}

export interface AuthenticatedUser {
  userId: string;
  name?: string;
  role: string;
}

/**
 * Verification du JWT a la passerelle.
 *
 * 1. Jeton signe HS256 (secret partage JWT_SECRET, emetteur JWT_ISSUER) :
 *    le contrat vise avec le service IAuthentification (Utilisateurs).
 * 2. Jeton de demonstration non signe (alg=none, signature "demo", charge
 *    utile { sub, name, role }) : accepte en developpement uniquement, quand
 *    AUTH_ACCEPT_DEMO_TOKEN=true — le mode demo du front continue de fonctionner
 *    sans toucher au module Utilisateurs. Refuse en production.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private demoWarningLogged = false;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const path: string = request.path ?? request.url ?? '';
    if (path.startsWith('/api/docs')) return true;

    // 1. En-tete Bearer (services, scripts) ; 2. sinon cookie httpOnly du navigateur.
    const authHeader: string | undefined = request.headers?.authorization;
    let token: string | undefined;
    let viaCookie = false;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim();
    } else {
      token = readCookie(request.headers?.cookie, ACCESS_COOKIE);
      viaCookie = token !== undefined;
    }
    if (!token) {
      throw new UnauthorizedException('Jeton d authentification manquant');
    }
    if (viaCookie && !SAFE_METHODS.has(String(request.method ?? 'GET'))) {
      this.assertSameAppRequest(request);
    }
    request.user = this.verify(token);
    return true;
  }

  /**
   * Protection CSRF d'une ecriture authentifiee par COOKIE : le navigateur joint le cookie tout seul, donc on exige
   * l'en-tete `X-Auth-Mode: cookie` (que le front envoie) ET une origine autorisee (CORS_ORIGINS).
   */
  private assertSameAppRequest(request: {
    headers?: Record<string, string | undefined>;
  }): void {
    const allowed = (
      this.config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173'
    )
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const origin = request.headers?.origin;
    if (
      request.headers?.['x-auth-mode'] !== 'cookie' ||
      !origin ||
      !allowed.includes(origin)
    ) {
      throw new ForbiddenException('Requete refusee (origine non autorisee)');
    }
  }

  private verify(token: string): AuthenticatedUser {
    const secret =
      this.config.get<string>('JWT_SECRET') ?? 'change-me-in-production';
    const issuer = this.config.get<string>('JWT_ISSUER') ?? 'SmartCampus';

    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer,
      }) as { sub: string; name?: string; role?: string };
      if (!payload.sub || !payload.role) {
        throw new Error('payload incomplet (sub/role requis)');
      }
      return { userId: payload.sub, name: payload.name, role: payload.role };
    } catch {
      // pas un JWT signe valide : tente le jeton de demonstration (dev)
    }

    const acceptDemo =
      (this.config.get<string>('AUTH_ACCEPT_DEMO_TOKEN') ??
        (this.config.get<string>('NODE_ENV') === 'production'
          ? 'false'
          : 'true')) === 'true';

    if (acceptDemo) {
      const demo = this.parseDemoToken(token);
      if (demo) {
        if (!this.demoWarningLogged) {
          this.logger.warn(
            'AUTH_ACCEPT_DEMO_TOKEN=true : jeton de demonstration non signe accepte (mode dev uniquement)',
          );
          this.demoWarningLogged = true;
        }
        return demo;
      }
    }

    throw new UnauthorizedException('Jeton invalide ou expire');
  }

  /** Reconnait le jeton fictif du front : {alg:"none"}.{payload}.demo */
  private parseDemoToken(token: string): AuthenticatedUser | undefined {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[2] !== 'demo') return undefined;
    try {
      const header = JSON.parse(
        Buffer.from(parts[0], 'base64').toString('utf-8'),
      ) as { alg?: string };
      if (header.alg !== 'none') return undefined;

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      ) as { sub?: string; name?: string; role?: string };
      if (!payload.sub || !payload.role) return undefined;
      return { userId: payload.sub, name: payload.name, role: payload.role };
    } catch {
      return undefined;
    }
  }
}
