import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Passerelle API des Residences : la seule porte d'entree exposee au front.
 *  - verifie le JWT (HS256 partage avec le service Utilisateurs ; jeton de
 *    demo accepte en dev via AUTH_ACCEPT_DEMO_TOKEN)
 *  - applique les roles par route (@Roles)
 *  - transmet l'identite (X-User-Id / X-Role) aux microservices internes
 *  - proxifie /api/chambres, /api/demandes, /api/contrats
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('API_PREFIX', 'api');
  const port = parseInt(config.get<string>('GATEWAY_PORT', '3001'), 10);

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({ origin: true, credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SmartCampus - Residences : passerelle API')
    .setDescription(
      'Passerelle des microservices Residences (Chambres :3011, Demandes :3012, Contrats :3013)',
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(
    `Residences gateway running on http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(`Swagger docs at http://localhost:${port}/${apiPrefix}/docs`);
}
void bootstrap();
