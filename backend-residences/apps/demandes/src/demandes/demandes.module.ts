import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChambresHttpClient } from '../chambres-http/chambres-http.client';
import { DemandesController } from './demandes.controller';
import { EVENTS_PUBLISHER, DemandesService } from './demandes.service';
import { DemandeHebergement } from './entities/demande-hebergement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DemandeHebergement]),
    ClientsModule.registerAsync([
      {
        name: EVENTS_PUBLISHER,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              config.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672',
            ],
            // File durable consommee par le service Contrats (transport RMQ de
            // Nest : communication file-a-file, routage par `pattern`).
            queue:
              config.get<string>('RABBITMQ_QUEUE') ??
              'residences.contrats.events',
            queueOptions: { durable: true },
            persistent: true,
          },
        }),
      },
    ]),
  ],
  controllers: [DemandesController],
  providers: [DemandesService, ChambresHttpClient],
  exports: [DemandesService],
})
export class DemandesModule {}
