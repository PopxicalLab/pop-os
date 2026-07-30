import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, ForbiddenException,
} from '@nestjs/common';
import { SoftwareService } from './software.service';
import { CreateSoftwareDto, UpdateSoftwareDto } from './software.dto';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/software')
export class SoftwareController {
  constructor(private readonly svc: SoftwareService) {}

  // ── master list ──────────────────────────────────────────────

  @Get()
  findAll() { return this.svc.findAll(); }

  @Post()
  create(@Body() dto: CreateSoftwareDto, @Req() req: any) {
    requireAdmin(req);
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSoftwareDto, @Req() req: any) {
    requireAdmin(req);
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    return this.svc.remove(id);
  }

  // ── person tagging ───────────────────────────────────────────

  @Post('people/:personId/:softwareId')
  tagPerson(
    @Param('personId') personId: string,
    @Param('softwareId') softwareId: string,
    @Req() req: any,
  ) {
    requireAdmin(req);
    return this.svc.tagPerson(personId, softwareId);
  }

  @Delete('people/:personId/:softwareId')
  untagPerson(
    @Param('personId') personId: string,
    @Param('softwareId') softwareId: string,
    @Req() req: any,
  ) {
    requireAdmin(req);
    return this.svc.untagPerson(personId, softwareId);
  }
}
