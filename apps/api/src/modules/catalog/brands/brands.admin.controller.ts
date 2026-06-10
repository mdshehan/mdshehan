import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import {
  createBrandSchema,
  updateBrandSchema,
  CreateBrandDto,
  UpdateBrandDto,
} from './brands.dto';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('admin/brands')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BrandsAdminController {
  constructor(private readonly brands: BrandsService) {}

  @Post()
  @Permissions('brand.create')
  create(@Body(new ZodValidationPipe(createBrandSchema)) dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Patch(':id')
  @Permissions('brand.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBrandSchema)) dto: UpdateBrandDto,
  ) {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  @Permissions('brand.delete')
  remove(@Param('id') id: string) {
    return this.brands.remove(id);
  }
}
