// API endpoints for skills and ratings:
//   GET    /api/skills                              master skill list
//   POST   /api/skills                              add a skill to the list
//   POST   /api/people/:id/skills                   give a person a skill
//   PATCH  /api/person-skills/:psId/rating          change a rating (logs history)
//   GET    /api/person-skills/:psId/history         see all changes
//   DELETE /api/person-skills/:psId                 remove a skill from a person
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { SkillsService } from './skills.service';
import { CreateSkillDto, AssignSkillDto, ChangeRatingDto } from './skill.dto';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get('skills')
  listSkills() {
    return this.skills.listSkills();
  }

  @Post('skills')
  createSkill(@Body() dto: CreateSkillDto, @Req() req: any) {
    requireAdmin(req);
    return this.skills.createSkill(dto);
  }

  @Post('people/:id/skills')
  assign(@Param('id') personId: string, @Body() dto: AssignSkillDto) {
    return this.skills.assignSkill(personId, dto);
  }

  @Patch('person-skills/:psId/rating')
  changeRating(@Param('psId') psId: string, @Body() dto: ChangeRatingDto) {
    return this.skills.changeRating(psId, dto);
  }

  @Get('person-skills/:psId/history')
  history(@Param('psId') psId: string) {
    return this.skills.history(psId);
  }

  @Delete('person-skills/:psId')
  remove(@Param('psId') psId: string) {
    return this.skills.removeAssignment(psId);
  }
}
