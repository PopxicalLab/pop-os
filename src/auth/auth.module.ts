import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    JwtModule.register({
      // Set JWT_SECRET in your .env file. The fallback is for local dev only.
      secret: process.env.JWT_SECRET || 'pop-os-dev-secret-change-in-production',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService],
  // Export JwtModule so JwtAuthGuard (in AppModule) can use JwtService
  exports: [JwtModule],
})
export class AuthModule {}
