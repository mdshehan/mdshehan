import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  createProductSchema,
  updateProductSchema,
  CreateProductDto,
  UpdateProductDto,
} from './products.dto';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsAdminController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @Permissions('product.create')
  create(@Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @Permissions('product.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @Permissions('product.delete')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }
}
