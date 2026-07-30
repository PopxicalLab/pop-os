import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSoftwareDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() category?: string;
}

export class UpdateSoftwareDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() category?: string;
}
