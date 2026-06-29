import { IsString, IsNotEmpty } from 'class-validator';

export class CreateJobTitleDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
