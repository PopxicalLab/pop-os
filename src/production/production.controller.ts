// GET /api/production/lanes  →  projects grouped by workflow lane
import { Controller, Get, Req } from '@nestjs/common';
import { ProductionService } from './production.service';

@Controller('api/production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('lanes')
  getLanes(@Req() req: any) {
    const personId = req.user?.role === 'STAFF' ? req.user.personId : undefined;
    return this.production.getLanes(personId ?? undefined, req.user?.company);
  }
}
