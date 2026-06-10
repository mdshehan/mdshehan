import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from './access.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly access: AccessService,
  ) {}

  private get accessTtl() {
    return Number(process.env.JWT_ACCESS_TTL ?? 900);
  }
  private get refreshTtl() {
    return Number(process.env.JWT_REFRESH_TTL ?? 2592000);
  }

  async register(dto: RegisterDto, meta: SessionMeta) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
    });
    return this.issueTokens(user.id, user.email, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user.id, user.email, meta);
  }

  async refresh(refreshToken: string, meta: SessionMeta) {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.authSession.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }
    const matches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!matches) {
      // Token reuse / tampering — revoke the whole session family for this user.
      await this.prisma.authSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    // Rotate: revoke old session, issue a fresh pair.
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    return this.issueTokens(user.id, user.email, meta);
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sid: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      await this.prisma.authSession.updateMany({
        where: { id: payload.sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // idempotent logout — ignore invalid tokens
    }
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        locale: true,
        roles: { include: { role: { select: { name: true, label: true } } } },
      },
    });
    const permissions = await this.access.getEffectivePermissions(userId);
    return {
      ...user,
      roles: user.roles.map((r) => r.role),
      permissions,
    };
  }

  private async issueTokens(userId: string, email: string, meta: SessionMeta) {
    const sessionId = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: this.accessTtl },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: this.refreshTtl },
    );

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: await bcrypt.hash(refreshToken, 10),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      },
    });

    return {
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
      expiresIn: this.accessTtl,
    };
  }
}
