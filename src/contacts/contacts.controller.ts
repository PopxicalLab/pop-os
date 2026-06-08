import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './contact.dto';

@Controller('api/contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()    findAll(@Query('accountId') accountId?: string) { return this.contacts.findAll(accountId); }
  @Get(':id') findOne(@Param('id') id: string)               { return this.contacts.findOne(id); }
  @Post()   create(@Body() dto: CreateContactDto)            { return this.contacts.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string) { return this.contacts.remove(id); }
}
