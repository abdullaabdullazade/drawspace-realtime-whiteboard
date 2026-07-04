import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
