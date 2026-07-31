import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
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
import { ReportStatus } from '../../../contracts';
import { IsUUIDv7 } from '../../../validators';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ReportQueryDto {
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
  operationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  templateId?: string;

  @ApiPropertyOptional({ enum: Object.values(ReportStatus) })
  @IsOptional()
  @IsIn(Object.values(ReportStatus))
  status?: ReportStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdTo?: Date;

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

export class CreateReportDto {
  @ApiProperty()
  @IsUUIDv7()
  businessUnitId!: string;

  @ApiProperty()
  @IsUUIDv7()
  templateId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  operationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(220)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class UpdateReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(220)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class ChangeReportStatusDto {
  @ApiProperty({ enum: Object.values(ReportStatus) })
  @IsIn(Object.values(ReportStatus))
  status!: ReportStatus;
}
