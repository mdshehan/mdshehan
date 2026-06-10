import { Controller, Post, UseGuards } from '@nestjs/common';
import { SearchIndexerService } from './search-indexer.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('admin/search')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SearchAdminController {
  constructor(private readonly indexer: SearchIndexerService) {}

  @Post('reindex')
  @Permissions('product.update')
  reindex() {
    return this.indexer.reindexAll();
  }
}
