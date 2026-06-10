import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBrandDto, UpdateBrandDto } from './brands.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBrandDto) {
    const exists = await this.prisma.brand.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`Slug '${dto.slug}' already in use`);
    return this.prisma.brand.create({ data: dto });
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.ensureExists(id);
    return this.prisma.brand.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.brand.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.brand.findFirst({ where: { id, deletedAt: null } });
    if (!found) throw new NotFoundException(`Brand '${id}' not found`);
  }

  list() {
    return this.prisma.brand.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async getBySlug(slug: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { slug, deletedAt: null },
      include: {
        products: {
          where: { status: 'published', deletedAt: null },
          take: 24,
          orderBy: { ratingAvg: 'desc' },
        },
      },
    });
    if (!brand) throw new NotFoundException(`Brand '${slug}' not found`);
    return brand;
  }
}
