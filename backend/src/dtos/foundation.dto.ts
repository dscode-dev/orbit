import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { IPaginatedResult } from '../contracts';
import { SortDirection } from '../contracts';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class PageResponseDto<T> implements IPaginatedResult<T> {
  @ApiProperty({ isArray: true })
  readonly data: readonly T[];

  @ApiProperty()
  readonly meta: IPaginatedResult<T>['meta'];

  constructor(result: IPaginatedResult<T>) {
    this.data = result.data;
    this.meta = result.meta;
  }
}

export class CursorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class SearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}

export class SortDto {
  @ApiProperty()
  @IsString()
  field!: string;

  @ApiProperty({ enum: Object.values(SortDirection) })
  @IsIn(Object.values(SortDirection))
  direction: SortDirection = SortDirection.ASC;
}

export class FilterDto {
  @ApiProperty()
  @IsString()
  field!: string;

  @ApiProperty()
  @IsString()
  operator!: string;

  @ApiProperty()
  value!: unknown;
}

export class SoftDeleteDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  force = false;
}

export class RestoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class FiltersDto {
  @ApiPropertyOptional({ type: FilterDto, isArray: true })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  @Type(() => FilterDto)
  filters?: FilterDto[];
}
