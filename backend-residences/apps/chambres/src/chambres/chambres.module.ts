import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChambresController } from './chambres.controller';
import { ChambresService } from './chambres.service';
import { Chambre } from './entities/chambre.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chambre])],
  controllers: [ChambresController],
  providers: [ChambresService],
  exports: [ChambresService],
})
export class ChambresModule {}
