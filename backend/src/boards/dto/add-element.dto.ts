import { IsEnum, IsObject, IsOptional, IsNumber } from 'class-validator';
import { ElementType } from '../entities/canvas-element.entity';

export class AddElementDto {
  @IsEnum(ElementType)
  type!: ElementType;

  @IsObject()
  data!: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  layer?: number;
}
