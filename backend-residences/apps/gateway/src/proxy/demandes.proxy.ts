import { Controller, Get, Post, Patch, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ProxyService } from './proxy.service';

/**
 * Proxifie /api/demandes vers le microservice Demandes.
 * Depot : etudiant. L'approbation/refus reste reserve a l'admin et
 * l'annulation au proprietaire (enforces par le service via X-User-Id).
 */
@ApiTags('Demandes (passerelle)')
@Controller('demandes')
export class DemandesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Post()
  @Roles('student')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('demandes', req), res);
  }

  @Get()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async find(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('demandes', req), res);
  }

  @Get('*')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findSub(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('demandes', req), res);
  }

  @Patch('*')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateStatut(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('demandes', req), res);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async pass(
    promise: Promise<{ status: number; json?: unknown }>,
    res: any,
  ) {
    const result = await promise;
    res.status(result.status);
    return result.json;
  }
}
