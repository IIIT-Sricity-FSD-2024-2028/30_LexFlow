import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for local development and include the custom 'role' header
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://10.0.5.168:5500',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'role', 'x-user-email'],
  });

  // Serve static files from the data/docs directory
  app.useStaticAssets(path.join(__dirname, '..', 'data', 'docs'), {
    prefix: '/data/docs/',
  });

  const config = new DocumentBuilder()
    .setTitle('LexFlow API')
    .setDescription('Legal ERP Backend')
    .setVersion('1.0')
    // document header-based role (client, lawyer, firmadmin, intern, superadmin)
    .addSecurity('role', { type: 'apiKey', in: 'header', name: 'role' })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // ensure docs folder exists and write swagger.json
  const swaggerPath = path.join(__dirname, '..', 'docs', 'swagger.json');
  fs.mkdirSync(path.dirname(swaggerPath), { recursive: true });
  fs.writeFileSync(swaggerPath, JSON.stringify(document, null, 2));

  // serve Swagger UI at /api
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`✅ NestJS Backend listening on port ${port}`);
}

bootstrap();
