import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AffiliateLinksService } from './affiliate-links.service';
import {
  createAffiliateLinkSchema,
  updateAffiliateLinkSchema,
  CreateAffiliateLinkDto,
  UpdateAffiliateLinkDto,
} from './affiliate.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('admin/affiliate-links')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AffiliateLinksAdminController {
  constructor(private readonly links: AffiliateLinksService) {}

  @Get()
  @Permissions('affiliate.view')
  list(@Query('product') productId?: string) {
    return this.links.list(productId);
  }

  @Post()
  @Permissions('affiliate.create')
  create(@Body(new ZodValidationPipe(createAffiliateLinkSchema)) dto: CreateAffiliateLinkDto) {
    return this.links.create(dto);
  }

  @Patch(':id')
  @Permissions('affiliate.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAffiliateLinkSchema)) dto: UpdateAffiliateLinkDto,
  ) {
    return this.links.update(id, dto);
  }

  @Delete(':id')
  @Permissions('affiliate.delete')
  remove(@Param('id') id: string) {
    return this.links.remove(id);
  }
}
