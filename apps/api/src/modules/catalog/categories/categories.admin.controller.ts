import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import {
  createCategorySchema,
  updateCategorySchema,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './categories.dto';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesAdminController {
  constructor(private readonly categories: CategoriesService) {}

  @Post()
  @Permissions('category.create')
  create(@Body(new ZodValidationPipe(createCategorySchema)) dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @Permissions('category.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @Permissions('category.delete')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
