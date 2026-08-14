import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsUUIDv7 } from '../../validators';
import {
  REPORT_FORMATS,
  REPORT_TYPE_KEYS,
  type ReportFormat,
} from './report.catalog';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const REPORT_STATUSES = ['PENDING', 'GENERATING', 'READY', 'FAILED'] as const;

/**
 * Pedido de geração.
 *
 * **Sem `timezone`.** O fuso é resolvido pelo servidor a partir da unidade de
 * negócio, e é o único jeito de dois relatórios do mesmo mês, gerados de
 * fusos diferentes, cobrirem o mesmo intervalo. Aceitar o fuso do navegador
 * faria "outubro" começar em horas diferentes conforme quem clicou.
 *
 * **Sem consulta, sem fórmula, sem campo livre de agregação.** O que se
 * escolhe é o tipo, o período e o recorte — o resto é código.
 */
export class GenerateReportDto {
  @ApiProperty({ enum: REPORT_TYPE_KEYS })
  @IsIn(REPORT_TYPE_KEYS)
  type!: string;

  @ApiProperty({ example: '2026-01-01' })
  @Type(() => Date)
  @IsDate()
  dateFrom!: Date;

  @ApiProperty({ example: '2026-01-31' })
  @Type(() => Date)
  @IsDate()
  dateTo!: Date;

  /** Ausente = organização inteira. */
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
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  operationKind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  operationStatus?: string;

  @ApiPropertyOptional({ enum: REPORT_FORMATS, default: 'PDF' })
  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat;
}

export class ReportQueryDto {
  @ApiPropertyOptional({ enum: REPORT_TYPE_KEYS })
  @IsOptional()
  @IsIn(REPORT_TYPE_KEYS)
  type?: string;

  @ApiPropertyOptional({ enum: REPORT_STATUSES })
  @IsOptional()
  @IsIn(REPORT_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  /** Autor da geração. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  generatedById?: string;

  /** Recorte pela data de **geração**, não pelo período do relatório. */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

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

export class ReportDownloadQueryDto {
  @ApiPropertyOptional({ enum: ['download', 'preview'], default: 'download' })
  @IsOptional()
  @IsIn(['download', 'preview'])
  operation: 'download' | 'preview' = 'download';
}
