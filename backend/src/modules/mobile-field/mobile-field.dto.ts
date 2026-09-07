import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const MOBILE_QUEUE_VIEWS = [
  'ALL',
  'TODAY',
  'OVERDUE',
  'IN_PROGRESS',
  'UPCOMING',
] as const;
export const MOBILE_WORK_ITEM_KINDS = [
  'SERVICE_OPERATION',
  'PMOC',
  'RVT',
] as const;

export class MobileWorkQueueQueryDto {
  @ApiPropertyOptional({ enum: MOBILE_QUEUE_VIEWS, default: 'ALL' })
  @IsOptional()
  @IsIn(MOBILE_QUEUE_VIEWS)
  view?: (typeof MOBILE_QUEUE_VIEWS)[number];

  @ApiPropertyOptional({ enum: MOBILE_WORK_ITEM_KINDS })
  @IsOptional()
  @IsIn(MOBILE_WORK_ITEM_KINDS)
  kind?: (typeof MOBILE_WORK_ITEM_KINDS)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}

/** Os tipos de documento que a tela de Documentos filtra. */
export const MOBILE_DOCUMENT_TYPES = ['SERVICE_ORDER', 'PMOC', 'RVT'] as const;

export class MobileDocumentsQueryDto {
  @ApiPropertyOptional({ enum: MOBILE_DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(MOBILE_DOCUMENT_TYPES)
  type?: (typeof MOBILE_DOCUMENT_TYPES)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}
