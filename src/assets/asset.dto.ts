import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { AssetStage } from '@prisma/client';

export class CreateAssetDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  projectId: string;

  @IsOptional()
  @IsEnum(AssetStage)
  stage?: AssetStage;

  @IsOptional()
  @IsBoolean()
  cdSignedOff?: boolean;

  @IsOptional()
  @IsString()
  changedBy?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AssetStage)
  stage?: AssetStage;

  @IsOptional()
  @IsBoolean()
  cdSignedOff?: boolean;

  @IsOptional()
  @IsString()
  changedBy?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
