// DTO = "Data Transfer Object". These describe the shape of data
// coming IN from the browser, and the @decorators are validation
// rules. If someone sends bad data, NestJS rejects it automatically
// before it ever reaches your database. This is your safety net.
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { EmploymentType, Company } from '@prisma/client';

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Role is required' })
  role: string;

  @IsString()
  @IsNotEmpty({ message: 'Department is required' })
  department: string;

  @IsDateString({}, { message: 'Start date must be a valid date' })
  startDate: string;

  @IsEnum(EmploymentType, {
    message: 'Employment type must be FULL_TIME, CONTRACT, FREELANCE or INTERN',
  })
  @IsOptional()
  employmentType?: EmploymentType;

  @IsBoolean()
  @IsOptional()
  warmPool?: boolean;

  @IsEnum(Company)
  @IsOptional()
  company?: Company;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salary?: number; // annual salary in £, used for man-day costing
}

// For updates, every field is optional (you might change just one thing).
export class UpdatePersonDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() department?: string;
  @IsDateString() @IsOptional() startDate?: string;
  @IsEnum(EmploymentType) @IsOptional() employmentType?: EmploymentType;
  @IsBoolean() @IsOptional() warmPool?: boolean;
  @IsEnum(Company) @IsOptional() company?: Company;
  @IsNumber() @Min(0) @IsOptional() salary?: number;
}
