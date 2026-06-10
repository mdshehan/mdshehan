import { Module } from '@nestjs/common';
import { MeiliService } from './meili.service';
import { SearchService } from './search.service';
import { SearchIndexerService } from './search-indexer.service';
import { SearchController } from './search.controller';
import { SearchAdminController } from './search.admin.controller';

@Module({
  controllers: [SearchController, SearchAdminController],
  providers: [MeiliService, SearchService, SearchIndexerService],
  exports: [SearchIndexerService],
})
export class SearchModule {}
