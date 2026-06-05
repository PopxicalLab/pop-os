// GET /api/ppm          →  score all active projects
// GET /api/ppm/:id      →  score one project
import { Controller, Get, Param } from '@nestjs/common';
import { PpmService } from './ppm.service';

@Controller('api/ppm')
export class PpmController {
  constructor(private readonly ppm: PpmService) {}

  @Get()
  scoreAll() { return this.ppm.scoreAll(); }

  @Get(':id')
  scoreOne(@Param('id') id: string) { return this.ppm.scoreProject(id); }
}
