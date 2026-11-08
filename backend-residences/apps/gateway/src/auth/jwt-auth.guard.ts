import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

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

    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Jeton d authentification manquant');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    request.user = this.verify(token);
    return true;
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
