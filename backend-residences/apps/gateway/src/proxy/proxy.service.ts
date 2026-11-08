import {
  Injectable,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../auth/jwt-auth.guard';

export type ServiceName = 'chambres' | 'demandes' | 'contrats';

export interface ForwardedResponse {
  status: number;
  json?: unknown;
}

/**
 * Proxifie une requete vers le microservice cible en transmettant
 * l'identite etablie par le JWT (X-User-Id / X-Name / X-Role).
 * Les services internes appliquent alors les regles de propriete.
 */
@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly config: ConfigService) {}

  private base(service: ServiceName): string {
    const fallback: Record<ServiceName, string> = {
      chambres: 'http://localhost:3011',
      demandes: 'http://localhost:3012',
      contrats: 'http://localhost:3013',
    };
    const key = `${service.toUpperCase()}_URL`;
    return this.config.get<string>(key) ?? fallback[service];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async forward(service: ServiceName, req: any): Promise<ForwardedResponse> {
    const url = `${this.base(service)}${req.originalUrl}`;
    const user = req.user as AuthenticatedUser | undefined;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (user) {
      headers['X-User-Id'] = user.userId;
      headers['X-Role'] = user.role;
      if (user.name) headers['X-Name'] = user.name;
    }

    const hasBody =
      !['GET', 'DELETE', 'HEAD'].includes(req.method) && req.body !== undefined;
    if (hasBody) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(url, {
        method: req.method,
        headers,
        body: hasBody ? JSON.stringify(req.body) : undefined,
      });
    } catch (error) {
      this.logger.error(
        `Service ${service} injoignable (${req.method} ${req.originalUrl}) : ${error}`,
      );
      throw new ServiceUnavailableException(
        `Le service ${service} est momentanement indisponible`,
      );
    }

    if (res.status === 204) return { status: 204 };
    const json = await res.json().catch(() => undefined);
    return { status: res.status, json };
  }
}
