import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the category tree (mega-menu structure). */
  async tree() {
    const all = await this.prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { position: 'asc' },
    });
    const byParent = new Map<string | null, typeof all>();
    for (const c of all) {
      const key = c.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: build(c.id) }));
    return build(null);
  }
}
