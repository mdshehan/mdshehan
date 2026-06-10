import { Module } from '@nestjs/common';
import { ProductsController } from './products/products.controller';
import { ProductsAdminController } from './products/products.admin.controller';
import { ProductsService } from './products/products.service';
import { BrandsController } from './brands/brands.controller';
import { BrandsAdminController } from './brands/brands.admin.controller';
import { BrandsService } from './brands/brands.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesAdminController } from './categories/categories.admin.controller';
import { CategoriesService } from './categories/categories.service';

@Module({
  controllers: [
    ProductsController,
    ProductsAdminController,
    BrandsController,
    BrandsAdminController,
    CategoriesController,
    CategoriesAdminController,
  ],
  providers: [ProductsService, BrandsService, CategoriesService],
})
export class CatalogModule {}
