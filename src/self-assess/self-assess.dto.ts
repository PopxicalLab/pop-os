import { IsString, IsNotEmpty, IsArray, IsInt, Min, Max, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SkillRatingItemDto {
  @IsString() @IsNotEmpty() skillId: string;
  @IsInt() @Min(1) @Max(5) rating: number;
}

export class SubmitSelfAssessDto {
  @IsString() @IsNotEmpty() personId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillRatingItemDto)
  ratings: SkillRatingItemDto[];

  @IsString() @IsOptional() note?: string;
}
