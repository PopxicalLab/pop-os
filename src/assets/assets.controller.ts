// GET    /api/assets?projectId=xxx  →  all assets (optionally filtered)
// GET    /api/assets/:id            →  single asset
// POST   /api/assets                →  create
// PATCH  /api/assets/:id            →  update stage / sign-off / name
// DELETE /api/assets/:id            →  remove
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto, UpdateAssetDto } from './asset.dto';

@Controller('api/assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.assets.findAll(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.assets.findOne(id); }

  @Post()
  create(@Body() dto: CreateAssetDto) { return this.assets.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assets.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.assets.remove(id); }
}
