import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

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
