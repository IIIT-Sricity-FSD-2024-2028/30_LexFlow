// Triggering restart
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppLoggerService } from './common/logger/logger.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { csrfMiddleware } from './common/middleware/csrf.middleware';
import { staticFilesMiddleware } from './common/middleware/static-files.middleware';
import { initDb } from './db';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = app.get(AppLoggerService);

  // Connect to Postgres, apply the schema delta and seed demo data (no-ops
  // when already applied/seeded) before any module touches the database.
  await initDb();

  // ── Security: Helmet HTTP headers ──────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // static docs are loaded cross-origin by the frontend
  }));

  // Parse cookies first so the CSRF middleware can use req.cookies
  app.use(cookieParser());

  // ── Security: CSRF (double-submit cookie; enforced only when a session cookie exists) ──
  app.use(csrfMiddleware);

  // ── Logging + Error Handling (global) ──────────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // ── Global Validation Pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://10.0.5.168:5500',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:60504',
      'http://localhost:8080',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'role',
      'x-user-id',
      'x-user-name',
      'x-client-id',
      'x-user-email',
      'x-csrf-token',
    ],
    credentials: true,
  });

  // Serve static files from the data/docs directory (with access logging + 404 handling)
  app.use('/data/docs', staticFilesMiddleware(logger));
  app.useStaticAssets(path.join(__dirname, '..', 'data', 'docs'), {
    prefix: '/data/docs/',
  });

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('LexFlow API')
    .setDescription(
      'REST API for the LexFlow Legal Platform.\n\n' +
      '**RBAC:** Pass `role` in the request header to identify the caller.\n' +
      'Accepted values: `client` | `lawyer` | `intern` | `firmadmin` | `superadmin`',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'role',
        in: 'header',
        description:
          'User role for RBAC. Values: client | lawyer | intern | firmadmin | superadmin',
      },
      'role-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ── Write swagger.json to /docs ────────────────────────────────────────────
  const swaggerPath = path.join(__dirname, '..', 'docs', 'swagger.json');
  fs.mkdirSync(path.dirname(swaggerPath), { recursive: true });
  fs.writeFileSync(swaggerPath, JSON.stringify(document, null, 2));

  // ── Serve Swagger UI ───────────────────────────────────────────────────────
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;

  await app.listen(port, '0.0.0.0');

  console.log(`🚀  LexFlow API running on  → http://127.0.0.1:${port} (or http://localhost:${port})`);
  console.log(`📚  Swagger UI available at → http://127.0.0.1:${port}/api/docs`);
  console.log(`✅  NestJS Backend listening on port ${port} (IPv4)`);
}

bootstrap();