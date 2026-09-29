// DTOs define the shape of data coming IN to the API.
// class-validator decorators enforce rules before the service ever sees the data.
import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString,
} from 'class-validator';
import { ProjectQuadrant, ProjectPriority, ProjectStatus, Company } from '@prisma/client';

export class CreateProjectDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsOptional() @IsString()
  client?: string;

  @IsEnum(ProjectQuadrant)
  quadrant: ProjectQuadrant;

  @IsOptional() @IsEnum(ProjectPriority)
  priority?: ProjectPriority;

  @IsOptional() @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  deadline?: string;

  // PM's own detailed schedule link — Google Calendar, Goodday, a Gantt board, etc.
  @IsOptional() @IsString()
  timelineUrl?: string;

  @IsOptional() @IsString()
  producerId?: string;

  @IsOptional() @IsString()
  pmId?: string;

  @IsEnum(Company)
  company: Company;
}

// For updates every field is optional — you might change just one thing.
//
// Production fields only. Money (value, margin, tier) and the PPM assessment
// (quadrant, complexity, duration, Drain approvals) belong to the job and are
// changed on the Job page via PATCH /api/leads — so they are deliberately NOT
// here, and the global ValidationPipe (whitelist: true) drops them if sent.
// That keeps project-only roles (TEAM_LEAD) from writing money they can't see.
// (Create still takes `quadrant` — a new project needs a starting lane; it's
// saved on the new project's auto job too.)
export class UpdateProjectDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString()               client?: string;
  @IsOptional() @IsEnum(Company)          company?: Company;
  @IsOptional() @IsEnum(ProjectPriority)  priority?: ProjectPriority;
  @IsOptional() @IsEnum(ProjectStatus)    status?: ProjectStatus;
  @IsOptional() @IsDateString()           startDate?: string;
  @IsOptional() @IsDateString()           deadline?: string;
  @IsOptional() @IsString()               timelineUrl?: string;
  @IsOptional() @IsString()               producerId?: string;
  @IsOptional() @IsString()               pmId?: string;
}
