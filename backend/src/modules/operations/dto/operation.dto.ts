import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  OperationKind,
  OperationPriority,
  OperationStatus,
} from '../../../contracts';
import { IsUUIDv7 } from '../../../validators';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class OperationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(220)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  assignedUserId?: string;

  @ApiPropertyOptional({ enum: Object.values(OperationKind) })
  @IsOptional()
  @IsIn(Object.values(OperationKind))
  kind?: OperationKind;

  @ApiPropertyOptional({ enum: Object.values(OperationStatus) })
  @IsOptional()
  @IsIn(Object.values(OperationStatus))
  status?: OperationStatus;

  @ApiPropertyOptional({ enum: Object.values(OperationPriority) })
  @IsOptional()
  @IsIn(Object.values(OperationPriority))
  priority?: OperationPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledTo?: Date;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class CreateOperationDto {
  @ApiProperty()
  @IsUUIDv7()
  businessUnitId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  assetId?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @ApiProperty({ enum: Object.values(OperationKind) })
  @IsIn(Object.values(OperationKind))
  kind!: OperationKind;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(220)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: Object.values(OperationPriority) })
  @IsOptional()
  @IsIn(Object.values(OperationPriority))
  priority?: OperationPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledStart?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledEnd?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  responsibleFieldTechnicianId?: string;

  @ApiPropertyOptional({ type: [String], description: 'auxiliares técnico' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUIDv7({ each: true })
  auxiliaryTechnicianIds?: string[];
}

export class UpdateOperationDto extends PartialType(CreateOperationDto) {}

export class ChangeOperationStatusDto {
  @ApiProperty({ enum: Object.values(OperationStatus) })
  @IsIn(Object.values(OperationStatus))
  status!: OperationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignOperationUserDto {
  @ApiProperty()
  @IsUUIDv7()
  userId!: string;
}

export class ReplaceResponsibleFieldTechnicianDto {
  @ApiProperty()
  @IsUUIDv7()
  userId!: string;
}

export class AddAuxiliaryTechnicianDto extends ReplaceResponsibleFieldTechnicianDto {}
