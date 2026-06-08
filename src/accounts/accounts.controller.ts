// GET    /api/accounts        → list all
// GET    /api/accounts/:id    → one account with contacts, leads, projects
// POST   /api/accounts        → create
// PATCH  /api/accounts/:id    → update
// DELETE /api/accounts/:id    → remove
import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './account.dto';

@Controller('api/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()    findAll()                                      { return this.accounts.findAll(); }
  @Get(':id') findOne(@Param('id') id: string)             { return this.accounts.findOne(id); }
  @Post()   create(@Body() dto: CreateAccountDto)          { return this.accounts.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string)           { return this.accounts.remove(id); }
}
