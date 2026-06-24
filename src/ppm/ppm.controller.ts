// GET /api/ppm             →  score all active projects
// GET /api/ppm/ai          →  AI k-NN recommendation from historical data
// GET /api/ppm/:id         →  score one project
import { Controller, Get, Param, Query } from '@nestjs/common';
import { PpmService } from './ppm.service';

@Controller('api/ppm')
export class PpmController {
  constructor(private readonly ppm: PpmService) {}

  @Get()
  scoreAll() { return this.ppm.scoreAll(); }

  // Must be declared before :id so the literal path 'ai' is not matched as a project id.
  @Get('ai')
  aiRecommend(
    @Query('value')      value:      string,
    @Query('complexity') complexity: string,
    @Query('tier')       tier:       string,
    @Query('margin')     margin:     string,
    @Query('excludeId')  excludeId:  string,
  ) {
    return this.ppm.aiRecommend({
      estimatedValue:  value      ? parseFloat(value)      : null,
      complexityScore: complexity ? parseFloat(complexity) : null,
      clientTier:      tier       || null,
      marginTarget:    margin     ? parseFloat(margin)     : null,
      excludeId:       excludeId  || undefined,
    });
  }

  @Get(':id')
  scoreOne(@Param('id') id: string) { return this.ppm.scoreProject(id); }
}
