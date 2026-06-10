import { Controller, Get } from '@nestjs/common';
import { LocalizationService } from './localization.service';

@Controller()
export class LocalizationController {
  constructor(private readonly localization: LocalizationService) {}

  @Get('config')
  config() {
    return this.localization.config();
  }

  @Get('countries')
  countries() {
    return this.localization.countries();
  }

  @Get('currencies')
  currencies() {
    return this.localization.currencies();
  }

  @Get('languages')
  languages() {
    return this.localization.languages();
  }
}
