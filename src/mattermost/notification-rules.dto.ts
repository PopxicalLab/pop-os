import { Type } from 'class-transformer';
import { CAPACITY_SECTION_KEYS } from './notification-events';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min,
  MinLength, ValidateNested,
} from 'class-validator';

export class TargetDto {
  @IsIn(['CHANNEL', 'USER']) type: 'CHANNEL' | 'USER';

  // CHANNEL: the channel's URL name (e.g. "capacity"). Required when type = CHANNEL.
  @IsOptional() @IsString() channel?: string;

  // USER: the Pop OS login user to DM. Required when type = USER.
  @IsOptional() @IsString() userId?: string;

  // USER: optional override when the Mattermost username can't be found by email.
  @IsOptional() @IsString() mattermostUsername?: string;
}

// Settings for the CAPACITY_WEEKLY event.
export class CapacityOptionsDto {
  @IsArray() @IsIn(CAPACITY_SECTION_KEYS, { each: true }) sections: string[];
  @IsIn(['CURRENT', 'NEXT']) week: 'CURRENT' | 'NEXT';
  @IsArray() @IsString({ each: true }) departments: string[];
  @IsBoolean() includeUnbooked: boolean;
}

export class CreateRuleDto {
  @IsString() @MinLength(1) name: string;

  // Must match a key in EVENT_CATALOGUE (checked again in the service).
  @IsIn(['CAPACITY_WEEKLY']) event: 'CAPACITY_WEEKLY';

  @IsOptional() @IsBoolean() enabled?: boolean;

  @IsOptional() @IsIn(['LPS', 'PXL', 'GROUP']) company?: 'LPS' | 'PXL' | 'GROUP' | null;

  // 1 = Monday … 7 = Sunday. Read as GMT+8.
  @IsOptional() @IsInt() @Min(1) @Max(7) dayOfWeek?: number;

  // "HH:mm" 24-hour, read as GMT+8.
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'timeOfDay must be HH:mm (24-hour)' })
  timeOfDay?: string;

  // Event-specific settings — see CapacityOptionsDto.
  @IsOptional() @ValidateNested() @Type(() => CapacityOptionsDto)
  options?: CapacityOptionsDto;

  @IsArray() @ValidateNested({ each: true }) @Type(() => TargetDto)
  targets: TargetDto[];
}

export class UpdateRuleDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['LPS', 'PXL', 'GROUP']) company?: 'LPS' | 'PXL' | 'GROUP' | null;
  @IsOptional() @IsInt() @Min(1) @Max(7) dayOfWeek?: number;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'timeOfDay must be HH:mm (24-hour)' })
  timeOfDay?: string;

  @IsOptional() @ValidateNested() @Type(() => CapacityOptionsDto)
  options?: CapacityOptionsDto;

  // When present, REPLACES the whole target list.
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TargetDto)
  targets?: TargetDto[];
}
