import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ensureSchemaExists, loadEnvFiles } from './config/ensure-schema';
import { internalKeyMiddleware, resolveInternalKey } from './config/internal-key';

async function bootstrap(): Promise<void> {
  loadEnvFiles();
  await ensureSchemaExists(process.env.DB_CHAMBRES_SCHEMA ?? 'BDD_Chambres');

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('API_PREFIX', 'api');
  const port = parseInt(config.get<string>('CHAMBRES_PORT', '3011'), 10);

  app.setGlobalPrefix(apiPrefix);
  // Service INTERNE : pas de CORS (jamais appele par un navigateur) ; seule la passerelle, porteuse de la cle, est acceptee.
  app.use(internalKeyMiddleware(resolveInternalKey()));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SmartCampus - Residences : Chambres')
    .setDescription('Microservice Chambres (schema BDD_Chambres)')
    .setVersion('2.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  // Par defaut uniquement la boucle locale ; en conteneur BIND_HOST=0.0.0.0 (reseau interne non publie).
  await app.listen(port, process.env.BIND_HOST ?? '127.0.0.1');

  const logger = new Logger('Bootstrap');
  logger.log(
    `Chambres service running on http://localhost:${port}/${apiPrefix}`,
  );
}
void bootstrap();
