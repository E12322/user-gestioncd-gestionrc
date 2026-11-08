import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChambresHttpClient } from '../chambres-http/chambres-http.client';
import { ContratsEventsController } from './contrats-events.controller';
import { ContratsController } from './contrats.controller';
import { ContratsService } from './contrats.service';
import { Contrat } from './entities/contrat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contrat])],
  controllers: [ContratsController, ContratsEventsController],
  providers: [ContratsService, ChambresHttpClient],
  exports: [ContratsService],
})
export class ContratsModule {}
