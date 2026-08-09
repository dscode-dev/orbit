import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { InventoryMovementType } from '../../contracts';
import { IsUUIDv7 } from '../../validators';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const bool = ({ value }: { value: unknown }): unknown =>
  value === true || value === 'true';

/**
 * Base de todo movimento digitado.
 *
 * **Não existe `type` aqui.** Cada ação tem endpoint próprio — entrada,
 * consumo, devolução, ajuste — porque cada uma significa uma coisa diferente
 * no chão da oficina, e um campo genérico permitiria registrar consumo como
 * entrada por um erro de digitação. O tipo é decidido pela rota.
 */
class MovementBaseDto {
  @ApiProperty()
  @IsUUIDv7()
  catalogItemId!: string;

  /** Unidade dona do estoque; a da sessão quando ausente. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  /** Sempre positiva — a direção é do tipo, nunca do sinal. */
  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Max(9_999_999)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /**
   * Identidade da origem, para tornar a chamada idempotente.
   *
   * Quando informada, repetir a requisição **não** cria um segundo movimento
   * do mesmo item — é a proteção para retry de rede e para cliente offline que
   * reenvia. Sem ela, duas chamadas iguais são dois fatos, o que é o certo
   * para lançamento digitado à mão.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  sourceEntityId?: string;
}

/**
 * O motivo é declarado por rota, não na base.
 *
 * Herdar um `reason?: string` e redeclará-lo obrigatório no ajuste exigiria
 * `declare`, que **não emite decorador nenhum** — a validação sumiria em
 * silêncio, e ajuste sem explicação passaria. Foi exatamente o que aconteceu
 * antes de o E2E pegar.
 */
export class InventoryEntryDto extends MovementBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * Consumo em campo.
 *
 * `operationId` é o vínculo com o trabalho que gastou o material. **Nada é
 * deduzido de orçamento**: proposta é intenção comercial, e o que se usa na
 * visita costuma diferir do que foi orçado — deduzir automaticamente daria
 * baixa em peça que ninguém tirou da prateleira.
 */
export class InventoryConsumptionDto extends MovementBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  operationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** Devolução ao estoque — material que voltou da visita sem ser usado. */
export class InventoryReturnDto extends MovementBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  operationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * Ajuste de inventário.
 *
 * `direction` distingue sobra de falta encontrada na contagem. O motivo é
 * **obrigatório**: um ajuste sem explicação é a diferença que ninguém consegue
 * justificar depois — e ajuste é justamente onde estoque some sem rastro.
 */
export class InventoryAdjustmentDto extends MovementBaseDto {
  @ApiProperty({ enum: ['IN', 'OUT'] })
  @IsIn(['IN', 'OUT'])
  direction!: 'IN' | 'OUT';

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/**
 * Transferência entre unidades.
 *
 * As duas pontas são gravadas na mesma transação, com a mesma identidade.
 * Quem a executa precisa de acesso às **duas** unidades — a política de RLS
 * recusa a inserção do lado de destino se ele não estiver no escopo da sessão.
 */
export class InventoryTransferDto {
  @ApiProperty()
  @IsUUIDv7()
  catalogItemId!: string;

  @ApiProperty()
  @IsUUIDv7()
  fromBusinessUnitId!: string;

  @ApiProperty()
  @IsUUIDv7()
  toBusinessUnitId!: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  @Max(9_999_999)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  sourceEntityId?: string;
}

/**
 * Estoque mínimo do par item + unidade.
 *
 * É a **única** escrita do módulo que não é movimento — e não altera saldo:
 * mínimo é política de reposição, não quantidade. `0` desliga o alerta.
 */
export class InventoryMinimumDto {
  @ApiProperty()
  @IsUUIDv7()
  catalogItemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(9_999_999)
  minimumStock!: number;
}

/* -------------------------------------------------------------------- */
/* Consultas                                                             */
/* -------------------------------------------------------------------- */

export class InventoryBalanceQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  catalogItemId?: string;

  /** Somente itens em `LOW` ou `OUT_OF_STOCK`. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  lowStock?: boolean;

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

export class InventoryMovementQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional({ enum: Object.values(InventoryMovementType) })
  @IsOptional()
  @IsIn(Object.values(InventoryMovementType))
  type?: InventoryMovementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  catalogItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  operationId?: string;

  @ApiPropertyOptional({ enum: ['MANUAL', 'OPERATION', 'SYSTEM'] })
  @IsOptional()
  @IsIn(['MANUAL', 'OPERATION', 'SYSTEM'])
  source?: string;

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

/** Recorte dos relatórios. Sem período, o servidor usa os últimos 30 dias. */
export class InventoryAnalyticsQueryDto {
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
