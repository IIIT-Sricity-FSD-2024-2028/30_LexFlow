import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Global Validation Pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strips unknown fields silently
      forbidNonWhitelisted: true, // throws 400 if unknown fields are sent
      transform: true,            // converts plain objects → DTO class instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors();

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('LexFlow API')
    .setDescription(
      'REST API for the LexFlow Legal Platform.\n\n' +
      '**RBAC:** Pass `role` in the request header to identify the caller.\n' +
      'Accepted values: `CLIENT` | `LAWYER` | `FIRM_MANAGER` | `SUPER_ADMIN`',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'role',
        in: 'header',
        description:
          'User role for RBAC enforcement. ' +
          'Values: CLIENT | LAWYER | FIRM_MANAGER | SUPER_ADMIN',
      },
      'role-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀  LexFlow API running on  → http://localhost:${port}`);
  console.log(`📚  Swagger UI available at → http://localhost:${port}/api/docs`);
}

bootstrap();
