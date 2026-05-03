import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Global Validation Pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
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
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'role', 'x-user-id', 'x-user-name'],
  });

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('LexFlow API')
    .setDescription(
      'REST API for the LexFlow Legal Platform.\n\n' +
      '**RBAC:** Pass `role` in the request header to identify the caller.\n' +
      'Accepted values: `client` | `lawyer` | `intern` | `firmadmin` | `superadmin`\n\n' +
      '**Identity:** Pass `x-user-id` for role-scoped data filtering (CLIENT/LAWYER views).',
    )
    .setVersion('1.0')
    .addSecurity('role', { type: 'apiKey', in: 'header', name: 'role' })
    .addApiKey(
      {
        type: 'apiKey',
        name: 'role',
        in: 'header',
        description: 'User role for RBAC. Values: client | lawyer | intern | firmadmin | superadmin',
      },
      'role-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Write swagger.json to docs/ for team reference
  const swaggerPath = path.join(__dirname, '..', 'docs', 'swagger.json');
  fs.mkdirSync(path.dirname(swaggerPath), { recursive: true });
  fs.writeFileSync(swaggerPath, JSON.stringify(document, null, 2));

  // Serve Swagger UI at /api/docs
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀  LexFlow API running on  → http://localhost:${port}`);
  console.log(`📚  Swagger UI available at → http://localhost:${port}/api/docs`);
}

bootstrap();
