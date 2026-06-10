import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LocalizationService {
  constructor(private readonly prisma: PrismaService) {}

  countries() {
    return this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { currency: true, defaultLanguage: true },
    });
  }

  currencies() {
    return this.prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  }

  languages() {
    return this.prisma.language.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  /** Public runtime config consumed by the storefront. */
  async config() {
    const [countries, currencies, languages, settings] = await Promise.all([
      this.countries(),
      this.currencies(),
      this.languages(),
      this.prisma.setting.findMany({ where: { isPublic: true } }),
    ]);
    const publicSettings = Object.fromEntries(
      settings.map((s) => [`${s.groupName}.${s.key}`, s.value]),
    );
    return { countries, currencies, languages, settings: publicSettings };
  }
}
