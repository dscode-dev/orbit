import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export const DashboardRange = {
  SEVEN_DAYS: '7D',
  THIRTY_DAYS: '30D',
  NINETY_DAYS: '90D',
} as const;

export class DashboardQueryDto {
  @ApiPropertyOptional({
    enum: Object.values(DashboardRange),
    default: DashboardRange.THIRTY_DAYS,
  })
  @IsOptional()
  @IsIn(Object.values(DashboardRange))
  range: string = DashboardRange.THIRTY_DAYS;

  @ApiPropertyOptional({
    description: 'Comma-separated widget tags',
    example: 'environment,intelligence',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}
