import { Controller, Get, Patch, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ProxyService } from './proxy.service';

/**
 * Proxifie /api/contrats vers le microservice Contrats.
 * Liste complete et resiliation : admin. Les consultations individuelles
 * restent ouvertes (le service verifie la propriete via X-User-Id).
 */
@ApiTags('Contrats (passerelle)')
@Controller('contrats')
export class ContratsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Get()
  @Roles('admin')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async find(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('contrats', req), res);
  }

  @Get('resident/*')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findByResident(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('contrats', req), res);
  }

  @Get('*')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findSub(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('contrats', req), res);
  }

  @Patch('*')
  @Roles('admin')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async resilier(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('contrats', req), res);
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
