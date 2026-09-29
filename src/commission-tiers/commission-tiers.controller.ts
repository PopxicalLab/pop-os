import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { CommissionTiersService } from './commission-tiers.service';
import { UpdateCommissionTierDto } from './commission-tier.dto';
import { ADMIN_ONLY, onlyRoles } from '../common/roles';

// Commission rates — admin-only settings on the Sales Performance tab.
@UseGuards(onlyRoles(ADMIN_ONLY))
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
