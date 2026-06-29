import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
      token: this.jwt.sign(payload),
      user:  { id: user.id, email: user.email, name: user.name, role: user.role, personId: user.personId ?? null, company },
    };
  }
}
