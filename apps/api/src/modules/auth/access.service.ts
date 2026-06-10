import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const SUPER_ADMIN_ROLE = 'super_admin';
export const WILDCARD = '*';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Effective permission names for a user:
   *   (role permissions ∪ user 'allow' overrides) − user 'deny' overrides.
   * Super Admin short-circuits to the wildcard '*'.
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        permissions: { include: { permission: true } },
      },
    });
    if (!user) return [];

    const isSuperAdmin = user.roles.some((r) => r.role.name === SUPER_ADMIN_ROLE);
    if (isSuperAdmin) return [WILDCARD];

    const allow = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) allow.add(rp.permission.name);
    }
    const deny = new Set<string>();
    for (const up of user.permissions) {
      if (up.effect === 'deny') deny.add(up.permission.name);
      else allow.add(up.permission.name);
    }
    return [...allow].filter((p) => !deny.has(p));
  }

  static has(granted: string[], required: string[]): boolean {
    if (granted.includes(WILDCARD)) return true;
    return required.every((r) => granted.includes(r));
  }
}
