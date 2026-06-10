import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, AvailabilityStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePriceDto, UpdatePriceDto } from './prices.dto';
import { CatalogEvents } from '../../common/events/catalog.events';

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Create or replace an offer; records price history + recomputes best price. */
  async upsertOffer(dto: CreatePriceDto) {
    const currency = await this.prisma.currency.findUnique({ where: { id: dto.currencyId } });
    if (!currency) throw new NotFoundException('Currency not found');
    const priceUsd = this.toUsd(dto.price, currency.usdRate);

    const offer = await this.prisma.price.upsert({
      where: {
        productId_variantId_storeId_countryId: {
          productId: dto.productId,
          variantId: dto.variantId ?? (null as unknown as string),
          storeId: dto.storeId,
          countryId: dto.countryId,
        },
      },
      update: {
        price: dto.price,
        priceUsd,
        listPrice: dto.listPrice,
        availability: dto.availability,
        shippingCost: dto.shippingCost,
        couponCode: dto.couponCode,
        affiliateLinkId: dto.affiliateLinkId,
        productUrl: dto.productUrl,
        lastCheckedAt: new Date(),
      },
      create: {
        productId: dto.productId,
        variantId: dto.variantId,
        storeId: dto.storeId,
        countryId: dto.countryId,
        currencyId: dto.currencyId,
        price: dto.price,
        priceUsd,
        listPrice: dto.listPrice,
        availability: dto.availability,
        shippingCost: dto.shippingCost,
        couponCode: dto.couponCode,
        affiliateLinkId: dto.affiliateLinkId,
        productUrl: dto.productUrl,
      },
    });

    await this.recordHistory(offer);
    await this.recomputeMinPrice(dto.productId);
    return offer;
  }

  async update(id: string, dto: UpdatePriceDto) {
    const existing = await this.prisma.price.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Price '${id}' not found`);

    let priceUsd = existing.priceUsd;
    if (dto.price !== undefined) {
      const currency = await this.prisma.currency.findUniqueOrThrow({
        where: { id: existing.currencyId },
      });
      priceUsd = new Prisma.Decimal(this.toUsd(dto.price, currency.usdRate));
    }

    const offer = await this.prisma.price.update({
      where: { id },
      data: { ...dto, priceUsd, lastCheckedAt: new Date() },
    });

    if (dto.price !== undefined || dto.availability !== undefined) {
      await this.recordHistory(offer);
      await this.recomputeMinPrice(offer.productId);
    }
    return offer;
  }

  async remove(id: string) {
    const existing = await this.prisma.price.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Price '${id}' not found`);
    await this.prisma.price.delete({ where: { id } });
    await this.recomputeMinPrice(existing.productId);
    return { success: true };
  }

  async getHistory(slug: string, days = 180, storeId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException(`Product '${slug}' not found`);

    const since = new Date(Date.now() - days * 86400_000);
    const rows = await this.prisma.priceHistory.findMany({
      where: {
        productId: product.id,
        recordedAt: { gte: since },
        ...(storeId ? { storeId } : {}),
      },
      orderBy: { recordedAt: 'asc' },
      select: { storeId: true, priceUsd: true, price: true, availability: true, recordedAt: true },
    });
    const lowest = rows.reduce<number | null>(
      (min, r) => (min === null ? Number(r.priceUsd) : Math.min(min, Number(r.priceUsd))),
      null,
    );
    return { days, lowestUsd: lowest, points: rows };
  }

  private async recordHistory(offer: {
    productId: string;
    variantId: string | null;
    storeId: string;
    countryId: string;
    price: Prisma.Decimal;
    priceUsd: Prisma.Decimal;
    availability: AvailabilityStatus;
  }) {
    await this.prisma.priceHistory.create({
      data: {
        productId: offer.productId,
        variantId: offer.variantId,
        storeId: offer.storeId,
        countryId: offer.countryId,
        price: offer.price,
        priceUsd: offer.priceUsd,
        availability: offer.availability,
      },
    });
  }

  /** Denormalize best (lowest) USD price onto the product for fast listing/sort. */
  private async recomputeMinPrice(productId: string) {
    const agg = await this.prisma.price.aggregate({
      where: { productId, availability: 'in_stock' },
      _min: { priceUsd: true },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: { minPriceUsd: agg._min.priceUsd ?? null },
    });
    // Best price changed → refresh search doc (and, later, caches/ISR).
    this.events.emit(CatalogEvents.ProductChanged, { productId });
  }

  private toUsd(price: number, usdRate: Prisma.Decimal): number {
    return Number((price * Number(usdRate)).toFixed(2));
  }
}
