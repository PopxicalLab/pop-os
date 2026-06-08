import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsInt, Min, Max } from 'class-validator';
import { LeadStatus, LeadPriority, Company } from '@prisma/client';

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
}
