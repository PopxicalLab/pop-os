import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { AuditService } from '../audit/audit.service';

// All routes here require ADMIN role — checked inline to keep it simple.
function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()      findAll(@Req() req: any)                              { requireAdmin(req); return this.users.findAll(); }
  @Get(':id') findOne(@Param('id') id: string, @Req() req: any)    { requireAdmin(req); return this.users.findOne(id); }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    requireAdmin(req);
    const result = await this.users.create(dto);
    this.audit.log(req.user, 'CREATE', 'User', result.id, result.email, result);
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    requireAdmin(req);
    const result = await this.users.update(id, dto);
    this.audit.log(req.user, 'UPDATE', 'User', result.id, result.email, result);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    const existing = await this.users.findOne(id);
    const result   = await this.users.remove(id);
    this.audit.log(req.user, 'DELETE', 'User', id, existing.email);
    return result;
  }
}
