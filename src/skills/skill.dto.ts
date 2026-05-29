// Validation shapes for the skills feature.
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { RatingSource } from '@prisma/client';

// Create a skill in the studio master list (e.g. "Rigging").
export class CreateSkillDto {
  @IsString()
  @IsNotEmpty({ message: 'Skill name is required' })
  name: string;
}

// Give a person a skill at a starting rating.
// This first entry is recorded in history with the chosen source
// (usually INTERVIEW for a new hire's initial self/interviewer score).
export class AssignSkillDto {
  @IsString()
  @IsNotEmpty({ message: 'skillId is required' })
  skillId: string;

  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 5' })
  @Max(5, { message: 'Rating must be between 1 and 5' })
  rating: number;

  @IsEnum(RatingSource, {
    message: 'source must be INTERVIEW, PROJECT_COMPLETION or MANUAL_ADJUSTMENT',
  })
  @IsOptional()
  source?: RatingSource;

  @IsString() @IsOptional() changedBy?: string;

  // Note required only when the initial source is a manual adjustment.
  @ValidateIf((o) => o.source === 'MANUAL_ADJUSTMENT')
  @IsString()
  @IsNotEmpty({ message: 'A note is required for a manual adjustment' })
  note?: string;
}

// Change an existing rating (up or down). Writes a history row.
export class ChangeRatingDto {
  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 5' })
  @Max(5, { message: 'Rating must be between 1 and 5' })
  newRating: number;

  @IsEnum(RatingSource, {
    message: 'source must be INTERVIEW, PROJECT_COMPLETION or MANUAL_ADJUSTMENT',
  })
  source: RatingSource;

  @IsString() @IsOptional() changedBy?: string;

  // THE RULE: a manual adjustment must carry a reason. Other sources
  // (e.g. project completion) may leave the note blank.
  @ValidateIf((o) => o.source === 'MANUAL_ADJUSTMENT')
  @IsString()
  @IsNotEmpty({ message: 'A note is required for a manual adjustment' })
  note?: string;
}
