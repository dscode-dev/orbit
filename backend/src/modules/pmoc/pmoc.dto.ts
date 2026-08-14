import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsUUIDv7 } from '../../validators';
import {
  COMPLIANCE_STATUSES,
  FREQUENCY_UNITS,
  PLAN_STATUSES,
  type FrequencyUnit,
} from './pmoc.domain';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** `YYYY-MM-DD` — vigência e vencimento são **dias**, não instantes. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreatePmocPlanDto {
  @ApiProperty()
  @IsUUIDv7()
  businessUnitId!: string;

  @ApiProperty()
  @IsUUIDv7()
  customerId!: string;

  @ApiProperty({ example: 'PMOC-2026-001' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  code!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(220)
  name!: string;

  @ApiProperty({ example: '2026-01-01' })
  @Matches(DATE_ONLY, { message: 'startsOn must be YYYY-MM-DD' })
  startsOn!: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'endsOn must be YYYY-MM-DD' })
  endsOn?: string;

  @ApiProperty({ example: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  frequencyAmount!: number;

  @ApiProperty({ enum: FREQUENCY_UNITS })
  @IsIn(FREQUENCY_UNITS)
  frequencyUnit!: FrequencyUnit;

  /** Antecedência do aviso de vencimento. Ver `evaluateCompliance`. */
  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dueSoonDays?: number;

  /**
   * Responsável técnico — **referência operacional**.
   *
   * É um membro da organização, não um registro profissional: o Orbit não
   * guarda CREA nem ART, e inventá-los aqui daria aparência de conformidade
   * regulatória a um campo que ninguém verifica. Esses dados existem no
   * formulário do artefato PMOC, preenchidos e assinados por quem responde
   * por eles.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  technicianUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

/**
 * Edição.
 *
 * **Sem `businessUnitId`, `customerId` e `code`**: mudar qualquer um deles
 * transformaria o plano em outro, com as execuções do anterior penduradas nele.
 * Quem errou cria outro plano; o histórico dos dois continua legível.
 */
export class UpdatePmocPlanDto extends PartialType(CreatePmocPlanDto) {
  override businessUnitId?: never;
  override customerId?: never;
  override code?: never;
}

export class TransitionPmocPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AddPmocCoverageDto {
  @ApiProperty()
  @IsUUIDv7()
  assetId!: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'startsOn must be YYYY-MM-DD' })
  startsOn?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'endsOn must be YYYY-MM-DD' })
  endsOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * Conclusão de um ciclo.
 *
 * `performedAt` é **quando a manutenção aconteceu**, não quando alguém
 * registrou: a próxima é contada a partir dela, e usar o instante do registro
 * empurraria o calendário a cada atraso de digitação.
 */
export class CompletePmocExecutionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  performedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  artifactExecutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Vínculo da evidência documental a um ciclo já existente. */
export class LinkPmocEvidenceDto {
  @ApiProperty()
  @IsUUIDv7()
  artifactExecutionId!: string;
}

export class CreatePmocOperationDto {
  @ApiPropertyOptional({ example: 'MAINTENANCE' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  kind?: string;

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
}

export class PmocPlanQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(220)
  search?: string;

  @ApiPropertyOptional({ enum: PLAN_STATUSES })
  @IsOptional()
  @IsIn(PLAN_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: COMPLIANCE_STATUSES })
  @IsOptional()
  @IsIn(COMPLIANCE_STATUSES)
  compliance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  customerId?: string;

  /** Planos que cobrem um equipamento específico. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  assetId?: string;

  /** Vencimento até esta data — "o que vence este mês". */
  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'dueUntil must be YYYY-MM-DD' })
  dueUntil?: string;

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

export class PmocAnalyticsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;
}

export class PmocUpcomingQueryDto {
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}
