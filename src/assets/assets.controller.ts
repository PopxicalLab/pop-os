// GET    /api/assets?projectId=xxx  →  all assets (optionally filtered)
// GET    /api/assets/:id            →  single asset
// POST   /api/assets                →  create  (STAFF cannot create)
// PATCH  /api/assets/:id            →  update  (STAFF can only update stage on own assets)
// DELETE /api/assets/:id            →  remove  (STAFF cannot delete)
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, ForbiddenException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto, UpdateAssetDto } from './asset.dto';

@Controller('api/assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  findAll(@Query('projectId') projectId: string | undefined, @Req() req: any) {
    const personId = req.user?.role === 'STAFF' ? req.user.personId : undefined;
    return this.assets.findAll(projectId, personId ?? undefined, req.user?.company);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.assets.findOne(id); }

  @Post()
  create(@Body() dto: CreateAssetDto, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot create assets');
    return this.assets.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @Req() req: any) {
    if (req.user?.role === 'STAFF') {
      // STAFF can only update the stage field on assets assigned to them
      const asset = await this.assets.findOne(id);
      if (asset.assignedToId !== req.user.personId) {
        throw new ForbiddenException('You can only update assets assigned to you');
      }
      return this.assets.update(id, { stage: dto.stage });
    }
    return this.assets.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot delete assets');
    return this.assets.remove(id);
  }
}
