// GET    /api/departments        → list all departments
// POST   /api/departments        → add a department (admin only)
// DELETE /api/departments/:id    → remove a department (admin only)
import { Controller, Get, Post, Delete, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './department.dto';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  findAll() { return this.departments.findAll(); }

  @Post()
  create(@Body() dto: CreateDepartmentDto, @Req() req: any) {
    requireAdmin(req);
    return this.departments.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    return this.departments.remove(id);
  }
}
