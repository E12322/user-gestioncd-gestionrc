import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ChambresProxyController } from './chambres.proxy';
import { DemandesProxyController } from './demandes.proxy';
import { ContratsProxyController } from './contrats.proxy';

@Module({
  controllers: [
    ChambresProxyController,
    DemandesProxyController,
    ContratsProxyController,
  ],
  providers: [ProxyService],
})
export class ProxyModule {}
