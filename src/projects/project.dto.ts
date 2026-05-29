// DTOs define the shape of data coming IN to the API.
// class-validator decorators enforce rules before the service ever sees the data.
import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsBoolean,
  IsNumber, Min, Max,
} from 'class-validator';
import { ProjectQuadrant, ProjectPriority, ProjectStatus, ClientTier, Company } from '@prisma/client';

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
  deadline?: string;

  @IsOptional() @IsString()
  producerId?: string;

  @IsOptional() @IsString()
  pmId?: string;

  @IsOptional() @IsBoolean()
  drainApprovedByExec?: boolean;

  @IsOptional() @IsBoolean()
  drainApprovedByProducer?: boolean;

  // PPM recommendation inputs
  @IsOptional() @IsNumber() @Min(0)
  estimatedValue?: number;

  @IsOptional() @IsNumber() @Min(1)
  estimatedDuration?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(5)
  complexityScore?: number;

  @IsOptional() @IsEnum(ClientTier)
  clientTier?: ClientTier;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  marginTarget?: number;

  @IsOptional() @IsEnum(Company)
  company?: Company;
}

// For updates every field is optional — you might change just one thing.
export class UpdateProjectDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString()               client?: string;
  @IsOptional() @IsEnum(Company)          company?: Company;
  @IsOptional() @IsEnum(ProjectQuadrant)  quadrant?: ProjectQuadrant;
  @IsOptional() @IsEnum(ProjectPriority)  priority?: ProjectPriority;
  @IsOptional() @IsEnum(ProjectStatus)    status?: ProjectStatus;
  @IsOptional() @IsDateString()           deadline?: string;
  @IsOptional() @IsString()               producerId?: string;
  @IsOptional() @IsString()               pmId?: string;
  @IsOptional() @IsBoolean()              drainApprovedByExec?: boolean;
  @IsOptional() @IsBoolean()              drainApprovedByProducer?: boolean;
  @IsOptional() @IsNumber() @Min(0)       estimatedValue?: number;
  @IsOptional() @IsNumber() @Min(1)       estimatedDuration?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5) complexityScore?: number;
  @IsOptional() @IsEnum(ClientTier)       clientTier?: ClientTier;
  @IsOptional() @IsNumber() @Min(0) @Max(100) marginTarget?: number;
}
