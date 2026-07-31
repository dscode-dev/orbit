import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';
import { IsUUIDv7 } from '../../../validators';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Defaults to 30 days ago',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Defaults to now',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ enum: ['DAY', 'WEEK', 'MONTH'], default: 'DAY' })
  @IsOptional()
  @IsIn(['DAY', 'WEEK', 'MONTH'])
  granularity?: 'DAY' | 'WEEK' | 'MONTH';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;
}
