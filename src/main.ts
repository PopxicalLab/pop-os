// This is where the program STARTS. It boots NestJS, turns on the
// automatic validation (so bad data gets rejected), and listens on
// the port from your .env file.
import * as path from 'path';
import * as dotenv from 'dotenv';
// Load .env from the project root (one level above dist/) so env vars
// are available whether running via ts-node (dev) or compiled dist (prod).
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Turn on validation globally. `whitelist` strips unknown fields;
  // `transform` converts incoming JSON into your DTO classes.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Pop OS running at http://localhost:${port}`);
}
bootstrap();
