import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttachmentCategory } from '@prisma/client';

// Text fields that come with an upload (multipart form fields next to "file").
export class CreateJobAttachmentDto {
  @IsOptional() @IsEnum(AttachmentCategory) category?: AttachmentCategory;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// Re-label an existing file (category / note). The file itself can't be
// replaced — delete and upload again instead, so history stays honest.
export class UpdateJobAttachmentDto {
  @IsOptional() @IsEnum(AttachmentCategory) category?: AttachmentCategory;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}
