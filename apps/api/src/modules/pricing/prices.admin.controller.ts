import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PricesService } from './prices.service';
import {
  createPriceSchema,
  updatePriceSchema,
  CreatePriceDto,
  UpdatePriceDto,
} from './prices.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('admin/prices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PricesAdminController {
  constructor(private readonly prices: PricesService) {}

  @Post()
  @Permissions('price.create')
  upsert(@Body(new ZodValidationPipe(createPriceSchema)) dto: CreatePriceDto) {
    return this.prices.upsertOffer(dto);
  }

  @Patch(':id')
  @Permissions('price.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePriceSchema)) dto: UpdatePriceDto,
  ) {
    return this.prices.update(id, dto);
  }

  @Delete(':id')
  @Permissions('price.delete')
  remove(@Param('id') id: string) {
    return this.prices.remove(id);
  }
}
