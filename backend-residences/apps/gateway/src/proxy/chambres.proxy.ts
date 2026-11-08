import { Controller, Get, Post, Patch, Delete, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ProxyService } from './proxy.service';

/** Proxifie /api/chambres vers le microservice Chambres. */
@ApiTags('Chambres (passerelle)')
@Controller('chambres')
export class ChambresProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Get()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async find(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('chambres', req), res);
  }

  @Get('*')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findSub(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('chambres', req), res);
  }

  @Post()
  @Roles('admin')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('chambres', req), res);
  }

  @Post('*')
  @Roles('admin')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createSub(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('chambres', req), res);
  }

  @Patch('*')
  @Roles('admin')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async update(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('chambres', req), res);
  }

  @Delete('*')
  @Roles('admin')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async remove(@Req() req: any, @Res({ passthrough: true }) res: any) {
    return this.pass(this.proxy.forward('chambres', req), res);
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
