// The CONTROLLER maps web addresses to actions. Each method below
// becomes a URL your browser/frontend can call. The decorators
// (@Get, @Post, etc.) say which HTTP method and path.
//
//   GET    /api/people        -> list all
//   GET    /api/people/:id    -> get one
//   POST   /api/people        -> create
//   PATCH  /api/people/:id    -> update
//   DELETE /api/people/:id    -> delete
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { PeopleService } from './people.service';
import { CreatePersonDto, UpdatePersonDto } from './person.dto';

@Controller('api/people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  findAll() {
    return this.people.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.people.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePersonDto) {
    return this.people.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.people.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.people.remove(id);
  }
}
