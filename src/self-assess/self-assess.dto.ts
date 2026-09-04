import { IsString, IsNotEmpty, IsEmail, IsArray, IsInt, Min, Max, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SkillRatingItemDto {
  @IsString() @IsNotEmpty() skillId: string;
  @IsInt() @Min(1) @Max(5) rating: number;
}

// Public form submission — no login required. The submitter types their own
// name/email rather than picking from a list of existing People records.
export class SubmitSelfAssessDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEmail() email: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillRatingItemDto)
  ratings: SkillRatingItemDto[];

  @IsString() @IsOptional() note?: string;
}

// Admin submission — the admin has already matched the submitter to an
// existing Person, so ratings are written straight into the system instead
// of sitting in the pending-review queue.
export class AdminSubmitSelfAssessDto extends SubmitSelfAssessDto {
  @IsString() @IsNotEmpty() personId: string;
}

// Approve a submission. `personId` is required only when the submission
// wasn't matched to a Person at submit time — matches and approves in one step.
export class ApproveSelfAssessDto {
  @IsString() @IsOptional() personId?: string;
}
