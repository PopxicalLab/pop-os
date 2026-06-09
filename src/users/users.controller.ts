import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';

// All routes here require ADMIN role — checked inline to keep it simple.
function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()    findAll(@Req() req: any)                                    { requireAdmin(req); return this.users.findAll(); }
  @Get(':id') findOne(@Param('id') id: string, @Req() req: any)        { requireAdmin(req); return this.users.findOne(id); }
  @Post()   create(@Body() dto: CreateUserDto, @Req() req: any)        { requireAdmin(req); return this.users.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    requireAdmin(req); return this.users.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: any)     { requireAdmin(req); return this.users.remove(id); }
}
