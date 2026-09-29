import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsInt, Min, Max } from 'class-validator';
import { LeadStatus, LeadPriority, Company, ClientTier, ProjectQuadrant } from '@prisma/client';

export class CreateLeadDto {
  @IsString() name: string;
  @IsOptional() @IsString()           accountId?: string;
  @IsOptional() @IsString()           contactId?: string;
  @IsOptional() @IsEnum(LeadStatus)   status?: LeadStatus;
  @IsOptional() @IsEnum(LeadPriority) priority?: LeadPriority;
  @IsOptional() @IsNumber()           estimatedValue?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) invoicedPct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) paidPct?: number;
  @IsOptional() @IsString()           paymentDate?: string;
  @IsOptional() @IsBoolean()          completed?: boolean;
  @IsOptional() @IsString()           notes?: string;
  @IsOptional() @IsString()           closedById?: string;
  @IsOptional() @IsEnum(Company)      company?: Company;
  @IsOptional() @IsNumber() @Min(0) @Max(100) marginTarget?: number;
  @IsOptional() @IsEnum(ClientTier)   clientTier?: ClientTier;
}

export class UpdateLeadDto {
  @IsOptional() @IsString()           name?: string;
  @IsOptional() @IsString()           accountId?: string;
  @IsOptional() @IsString()           contactId?: string;
  @IsOptional() @IsEnum(LeadStatus)   status?: LeadStatus;
  @IsOptional() @IsEnum(LeadPriority) priority?: LeadPriority;
  @IsOptional() @IsNumber()           estimatedValue?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) invoicedPct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) paidPct?: number;
  @IsOptional() @IsString()           paymentDate?: string;
  @IsOptional() @IsBoolean()          completed?: boolean;
  @IsOptional() @IsString()           notes?: string;
  @IsOptional() @IsString()           closedById?: string;
  @IsOptional() @IsString()           projectId?: string;
  @IsOptional() @IsEnum(Company)      company?: Company;
  // Job money fields (moved from Project in the Sept 2026 job restructure).
  @IsOptional() @IsNumber() @Min(0) @Max(100) marginTarget?: number;
  @IsOptional() @IsEnum(ClientTier)   clientTier?: ClientTier;
  // PPM assessment — done on the Job page before quoting.
  @IsOptional() @IsEnum(ProjectQuadrant)         quadrant?: ProjectQuadrant;
  @IsOptional() @IsInt() @Min(1) @Max(5)         complexityScore?: number;
  @IsOptional() @IsInt() @Min(1)                 estimatedDuration?: number;
  @IsOptional() @IsBoolean()                     drainApprovedByExec?: boolean;
  @IsOptional() @IsBoolean()                     drainApprovedByProducer?: boolean;
}
