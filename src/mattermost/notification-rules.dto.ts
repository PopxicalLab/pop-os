import { Type } from 'class-transformer';
import { EVENT_KEYS } from './notification-events';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, Min,
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

export class CreateRuleDto {
  @IsString() @MinLength(1) name: string;

  // Must be a key in EVENT_CATALOGUE.
  @IsIn(EVENT_KEYS) event: string;

  @IsOptional() @IsBoolean() enabled?: boolean;

  @IsOptional() @IsIn(['LPS', 'PXL', 'GROUP']) company?: 'LPS' | 'PXL' | 'GROUP' | null;

  // 1 = Monday … 7 = Sunday. Read as GMT+8.
  @IsOptional() @IsInt() @Min(1) @Max(7) dayOfWeek?: number;

  // "HH:mm" 24-hour, read as GMT+8.
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'timeOfDay must be HH:mm (24-hour)' })
  timeOfDay?: string;

  // Event-specific settings. Shape depends on the event (capacity sections,
  // lead stages …) so it is checked and cleaned per event in the service
  // (normalizeOptions), not here.
  @IsOptional() @IsObject()
  options?: Record<string, unknown>;

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

  @IsOptional() @IsObject()
  options?: Record<string, unknown>;

  // When present, REPLACES the whole target list.
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TargetDto)
  targets?: TargetDto[];
}
