import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Normal session length is 12h (set in AuthModule's JwtModule.register). When
// "Stay logged in" is ticked, the token is issued with this longer expiry
// instead, so people on their own machine don't get logged out mid-week.
// Not literally forever — a token has to expire eventually — but long enough
// that in practice no one hits it during normal use.
const REMEMBER_ME_EXPIRY = '30d';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where:   { email: dto.email.toLowerCase().trim() },
      include: { person: { select: { company: true } } },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    // company comes from the linked Person record.
    // GROUP or null = no company filter applied (sees all data).
    const company = user.person?.company ?? null;

    // JWT payload — available on req.user in every guarded controller.
    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role, personId: user.personId ?? null, company };
    return {
      // Overriding expiresIn per-call falls back to JwtModule's 12h default
      // when rememberMe isn't set — see JwtModule.register in auth.module.ts.
      token: this.jwt.sign(payload, dto.rememberMe ? { expiresIn: REMEMBER_ME_EXPIRY } : undefined),
      user:  { id: user.id, email: user.email, name: user.name, role: user.role, personId: user.personId ?? null, company },
    };
  }

  // Always returns the same generic result regardless of whether the email
  // matched an account — the caller must not use this to enumerate users.
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const GENERIC = { message: 'If that email has an account, a reset link has been sent.' };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user || !user.active) return GENERIC;

    // Raw token goes in the email link; only its hash is ever stored, same
    // principle as a password — a DB leak alone can't be used to reset accounts.
    const rawToken   = crypto.randomBytes(32).toString('hex');
    const tokenHash  = await bcrypt.hash(rawToken, 12);
    const expiresAt  = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data:  { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt },
    });

    const appUrl   = process.env.APP_URL || 'http://192.168.1.40:3000';
    const resetUrl = `${appUrl}/reset-password.html?uid=${user.id}&token=${rawToken}`;
    await this.notifications.sendPasswordResetEmail({ name: user.name, email: user.email, resetUrl });

    return GENERIC;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });

    if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
      throw new BadRequestException('This reset link is invalid or has already been used.');
    }
    if (user.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('This reset link has expired. Request a new one.');
    }

    const valid = await bcrypt.compare(dto.token, user.resetTokenHash);
    if (!valid) throw new BadRequestException('This reset link is invalid or has already been used.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { password: passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
    });

    return { message: 'Password updated. You can now sign in.' };
  }
}
