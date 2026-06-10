import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

const createStoreSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  websiteUrl: z.string().url().optional(),
  affiliateNetwork: z.string().max(60).optional(),
  baseAffiliateTag: z.string().max(120).optional(),
  isActive: z.boolean().default(true),
});
type CreateStoreDto = z.infer<typeof createStoreSchema>;

@Injectable()
class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.store.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateStoreDto) {
    return this.prisma.store.create({ data: dto });
  }
}

@Controller('admin/stores')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class StoresAdminController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @Permissions('store.view')
  list() {
    return this.stores.list();
  }

  @Post()
  @Permissions('store.create')
  create(@Body(new ZodValidationPipe(createStoreSchema)) dto: CreateStoreDto) {
    return this.stores.create(dto);
  }
}

@Module({
  controllers: [StoresAdminController],
  providers: [StoresService],
})
export class StoresModule {}
