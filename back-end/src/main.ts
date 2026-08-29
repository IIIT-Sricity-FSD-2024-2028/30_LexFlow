import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ── CORS ───────────────────────────────────────────────────────────────────
  // Must be configured before any other middleware so preflight OPTIONS
  // requests are handled correctly.
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

  // ── Helmet — comprehensive HTTP security headers ────────────────────────────
  // crossOriginResourcePolicy and crossOriginOpenerPolicy are set to
  // 'cross-origin' so the frontend dev server (port 5500) can read API
  // responses. Helmet's 'same-origin' default would silently block them.
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    contentSecurityPolicy: false, // CSP is handled separately if needed
  }));

  // ── Cookie parser (required for csurf cookie-based tokens) ─────────────────
  app.use(cookieParser());

  // ── CSRF protection ────────────────────────────────────────────────────────
  // Stateless signed-token scheme (cookieless double-submit). The server issues
  // `<nonce>.<hmac(nonce)>` from GET /csrf-token and the client echoes it back
  // in the x-csrf-token header on every mutating request. No cookie is needed,
  // so this works even when the frontend origin differs from the API origin
  // (e.g. Live Server on :5500 / LAN IP vs API on localhost:3000), where
  // browsers refuse to attach SameSite cookies to cross-site fetch calls.
  const CSRF_SECRET =
    process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

  function signCsrfNonce(nonce: string): string {
    return crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
  }

  // ── CSRF token endpoint ────────────────────────────────────────────────────
  // GET /csrf-token  →  { csrfToken: "<nonce>.<signature>" }
  // Frontend calls this once on startup (or before any mutating request) to
  // obtain a valid token, then attaches it as x-csrf-token on POST/PATCH/DELETE.
  app.use('/csrf-token', (req: Request, res: Response) => {
    const nonce = crypto.randomBytes(16).toString('hex');
    res.json({ csrfToken: `${nonce}.${signCsrfNonce(nonce)}` });
  });

  // ── Apply CSRF globally, but skip safe methods, Swagger, and pre-auth routes
  // Pre-auth routes (login / register) cannot carry a CSRF token because the
  // user hasn't authenticated yet — they are protected by credentials instead.
  const CSRF_SKIP_PATHS = [
    '/csrf-token',
    '/users/login',
    '/users/register',
    '/users/logout',
  ];

  app.use((req: Request, res: Response, next: NextFunction) => {
    const safeMethod   = /^(GET|HEAD|OPTIONS)$/i.test(req.method);
    const isSwagger    = req.path.startsWith('/api/docs') || req.path === '/api-json';
    const isSkippedPath = CSRF_SKIP_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'));
    if (safeMethod || isSwagger || isSkippedPath) return next();

    const token = (req.headers['x-csrf-token'] as string) || '';
    const dot = token.indexOf('.');
    let isValid = false;
    if (dot > 0) {
      const nonce = token.slice(0, dot);
      const sig   = token.slice(dot + 1);
      const expected = signCsrfNonce(nonce);
      // timing-safe compare (length check first — timingSafeEqual throws otherwise)
      isValid =
        sig.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    }
    if (isValid) return next();

    const err: Error & { code?: string } = new Error('invalid csrf token');
    err.code = 'EBADCSRFTOKEN';
    return next(err);
  });

  // ── Express-level CSRF error handler ───────────────────────────────────────
  // csurf throws at the Express middleware layer (before NestJS), so the
  // NestJS APP_FILTER never sees it. A 4-argument Express error handler placed
  // here catches EBADCSRFTOKEN and returns a clean 403 JSON response that the
  // frontend's auto-retry logic can act on.
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({
        statusCode: 403,
        message: 'invalid csrf token',
        error: 'Forbidden',
      });
    }
    next(err);
  });

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

  // ── Static assets ──────────────────────────────────────────────────────────
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

  console.log(`🚀  LexFlow API running on  → http://localhost:${port}`);
  console.log(`📚  Swagger UI available at → http://localhost:${port}/api/docs`);
  console.log(`✅  NestJS Backend listening on port ${port} (IPv4)`);
}

bootstrap();