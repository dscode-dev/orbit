import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsUUIDv7 } from '../../validators';

export const ChecklistItemType = {
  BOOLEAN: 'BOOLEAN',
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  SELECT: 'SELECT',
  PHOTO: 'PHOTO',
  SIGNATURE: 'SIGNATURE',
} as const;
export const ChecklistExecutionStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ChecklistItemDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(220)
  label!: string;

  @IsIn(Object.values(ChecklistItemType))
  type!: (typeof ChecklistItemType)[keyof typeof ChecklistItemType];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsObject()
  validation?: Record<string, unknown>;
}

export class CreateChecklistTemplateDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items!: ChecklistItemDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateChecklistTemplateDto extends PartialType(
  CreateChecklistTemplateDto,
) {}

export class ChecklistTemplateQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class StartChecklistExecutionDto {
  @ApiProperty()
  @IsUUIDv7()
  templateId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SaveChecklistAnswersDto {
  @IsObject()
  answers!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ChecklistExecutionQueryDto {
  @IsOptional()
  @IsUUIDv7()
  operationId?: string;

  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @IsOptional()
  @IsIn(Object.values(ChecklistExecutionStatus))
  status?: (typeof ChecklistExecutionStatus)[keyof typeof ChecklistExecutionStatus];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
