import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const dup = await this.prisma.category.findFirst({
      where: { slug: dto.slug, parentId: dto.parentId ?? null },
    });
    if (dup) throw new ConflictException(`Slug '${dto.slug}' already used under this parent`);

    let depth = 0;
    let path = dto.slug;
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException(`Parent '${dto.parentId}' not found`);
      depth = parent.depth + 1;
      path = `${parent.path ?? parent.slug}.${dto.slug}`;
    }
    return this.prisma.category.create({ data: { ...dto, depth, path } });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.category.findFirst({ where: { id, deletedAt: null } });
    if (!found) throw new NotFoundException(`Category '${id}' not found`);
  }

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
