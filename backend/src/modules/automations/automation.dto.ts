import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateIf,
} from 'class-validator';
import { IsUUIDv7 } from '../../validators';
import {
  ACTION_TYPES,
  CONDITION_OPERATORS,
  DELAY_UNITS,
  TRIGGER_TYPES,
  type ActionType,
  type ConditionOperator,
  type DelayUnit,
} from './automation.catalog';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const bool = ({ value }: { value: unknown }): unknown =>
  value === true || value === 'true';

/**
 * Uma condição declarativa.
 *
 * `value` aceita texto ou lista de textos — nada mais. Objeto ou número
 * abririam espaço para comparação estruturada, e comparação estruturada é o
 * primeiro passo para uma linguagem de expressão.
 */
export class AutomationConditionDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  field!: string;

  @ApiProperty({ enum: CONDITION_OPERATORS })
  @IsIn(CONDITION_OPERATORS)
  operator!: ConditionOperator;

  @ApiPropertyOptional()
  @IsOptional()
  value?: string | string[];
}

export class AutomationDelayDto {
  @ApiProperty({ example: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(520)
  amount!: number;

  @ApiProperty({ enum: DELAY_UNITS })
  @IsIn(DELAY_UNITS)
  unit!: DelayUnit;
}

/**
 * Uma ação.
 *
 * `config` é objeto livre **na forma**, mas cada tipo valida o que aceita no
 * serviço: uma chave desconhecida é recusada lá. Declarar todas as
 * combinações como classes distintas aqui daria seis DTOs para quatro ações e
 * ainda assim não cobriria a validação cruzada — `target = USER` exige
 * `userId`, e isso é regra, não forma.
 */
export class AutomationActionDto {
  @ApiProperty({ enum: ACTION_TYPES })
  @IsIn(ACTION_TYPES)
  type!: ActionType;

  @ApiPropertyOptional({ type: AutomationDelayDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AutomationDelayDto)
  delay?: AutomationDelayDto;

  @ApiProperty({ type: Object })
  @IsObject()
  config!: Record<string, unknown>;
}

/**
 * Criação de regra.
 *
 * **Sem `enabled`**: a regra nasce ligada. Criar desligada e esquecer de ligar
 * é o modo mais comum de uma automação não funcionar sem ninguém notar —
 * quem quiser preparar sem executar desliga logo depois, num ato explícito.
 */
export class CreateAutomationRuleDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: TRIGGER_TYPES })
  @IsIn(TRIGGER_TYPES)
  trigger!: string;

  /** Nula = vale para a organização inteira. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiPropertyOptional({ type: [AutomationConditionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AutomationConditionDto)
  conditions?: AutomationConditionDto[];

  @ApiProperty({ type: [AutomationActionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions!: AutomationActionDto[];
}

/**
 * Edição.
 *
 * `trigger` **não muda**: trocá-lo transformaria a regra em outra regra, com o
 * histórico de execuções da anterior pendurado nela. Quem errou o gatilho
 * duplica e ajusta.
 */
export class UpdateAutomationRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** UUID muda para unidade; `null` muda para escopo organizacional. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUIDv7()
  businessUnitId?: string | null;

  @ApiPropertyOptional({ type: [AutomationConditionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AutomationConditionDto)
  conditions?: AutomationConditionDto[];

  @ApiPropertyOptional({ type: [AutomationActionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions?: AutomationActionDto[];
}

/** Ligar e desligar é ato próprio, não campo de edição. */
export class ToggleAutomationRuleDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class AutomationRuleQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional({ enum: TRIGGER_TYPES })
  @IsOptional()
  @IsIn(TRIGGER_TYPES)
  trigger?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  businessUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  enabled?: boolean;

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

export class AutomationExecutionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUIDv7()
  ruleId?: string;

  @ApiPropertyOptional({
    enum: ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED'])
  status?: string;

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
