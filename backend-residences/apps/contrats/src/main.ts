import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ensureSchemaExists, loadEnvFiles } from './config/ensure-schema';

/**
 * Service Contrat : application hybride.
 *  - HTTP (REST) pour les consultations / resiliations
 *  - Microservice RabbitMQ : consomme demande.approuvee / demande.annulee
 *    emis par le service Demande. La file durable protege contre les
 *    indisponibilites du consommateur ; la creation de contrat est idempotente,
 *    ce qui autorise l'acquittement automatique a la livraison (noAck).
 */
async function bootstrap(): Promise<void> {
  loadEnvFiles();
  await ensureSchemaExists(process.env.DB_CONTRATS_SCHEMA ?? 'BDD_Contrats');

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('API_PREFIX', 'api');
  const port = parseInt(config.get<string>('CONTRATS_PORT', '3013'), 10);
  const rabbitUrl = config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
  const queue =
    config.get<string>('RABBITMQ_QUEUE') ?? 'residences.contrats.events';

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      // File durable alimentee par le service Demandes (transport RMQ de Nest :
      // communication file-a-file). noAck=true : le transport evenementiel de
      // Nest n'acquitte pas manuellement ; l'idempotence du consommateur rend
      // la re-livraison inutile, et la file garde les messages si le service
      // est arrete.
      queue,
      queueOptions: { durable: true },
      noAck: true,
    },
  });

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SmartCampus - Residences : Contrats')
    .setDescription('Microservice Contrats (schema BDD_Contrats)')
    .setVersion('2.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const logger = new Logger('Bootstrap');

  await app.listen(port);

  // Le consommateur RabbitMQ demarre sans bloquer l'HTTP : si le broker est
  // indisponible, le service reste joignable et reessaie en arriere-plan
  // (la file durable rejouera les evenements des qu'il se reconnecte).
  void app.startAllMicroservices();

  logger.log(
    `Contrats service running on http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(`Consuming queue "${queue}" from RabbitMQ (${rabbitUrl})`);
}
void bootstrap();
