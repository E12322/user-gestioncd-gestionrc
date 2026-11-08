import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

/** Etat des microservices Residences (utile pour la demonstration). */
@ApiTags('Sante')
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Etat de la passerelle et des 3 microservices' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async check(): Promise<Record<string, any>> {
    const services: Record<string, string> = {
      chambres:
        this.config.get<string>('CHAMBRES_URL') ?? 'http://localhost:3011',
      demandes:
        this.config.get<string>('DEMANDES_URL') ?? 'http://localhost:3012',
      contrats:
        this.config.get<string>('CONTRATS_URL') ?? 'http://localhost:3013',
    };

    const statuses: Record<string, string> = { gateway: 'up' };
    for (const [name, base] of Object.entries(services)) {
      try {
        const res = await fetch(`${base}/api/${name}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(2000),
        });
        statuses[name] = res.ok ? 'up' : `degraded (${res.status})`;
      } catch {
        statuses[name] = 'down';
      }
    }
    return statuses;
  }
}
