import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { CommissionTiersService } from './commission-tiers.service';
import { UpdateCommissionTierDto } from './commission-tier.dto';

@Controller('api/commission-tiers')
export class CommissionTiersController {
  constructor(private readonly svc: CommissionTiersService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCommissionTierDto) {
    return this.svc.update(id, dto);
  }
}
