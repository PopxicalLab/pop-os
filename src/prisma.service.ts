// This wraps the Prisma client so the rest of the app can ask the
// database for things. NestJS creates ONE of these and shares it.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    // Opens the connection to PostgreSQL when the app starts up.
    await this.$connect();
  }
}
