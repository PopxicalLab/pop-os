// GET /api/production/lanes  →  projects grouped by workflow lane
import { Controller, Get } from '@nestjs/common';
import { ProductionService } from './production.service';

@Controller('api/production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('lanes')
  getLanes() { return this.production.getLanes(); }
}
