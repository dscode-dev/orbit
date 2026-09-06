/**
 * Os quatro planos comerciais do Orbit.
 *
 * Este arquivo é a autoridade do catálogo. Ele é **explícito**: cada plano
 * declara as suas capacidades e todos os seus limites, sem herdar de outro em
 * tempo de execução. "Profissional + Inteligência é o Profissional mais IA" é
 * verdade comercial, não mecanismo — herança dinâmica economizaria vinte
 * linhas e cobraria a conta no dia em que um plano precisasse divergir.
 *
 * ## O que este catálogo não faz
 *
 * - **Não cobra.** Preço aqui é tabela; assinatura, período e cobrança são da
 *   PR-PL-02 em diante.
 * - **Não conhece periodicidade.** Cota é sempre mensal, mesmo que a cobrança
 *   venha a ser semestral ou anual — assinar por ano não adianta doze meses de
 *   uso de uma vez.
 * - **Não decide acesso.** Quem decide é o `EntitlementService`; o produto
 *   pergunta por capacidade, nunca por nome de plano.
 */
import {
  AllocationResource,
  PlanCapability,
  PlanCode,
  UNLIMITED,
  limited,
  type PlanDefinition,
  type PlanLimit,
  UsageResource,
} from './plan-catalog.types';

/** Toda capacidade do catálogo V1. O Empresarial recebe exatamente esta lista. */
const TODAS_AS_CAPACIDADES = Object.values(PlanCapability);

/** A camada operacional que todo plano tem — inteligência entra à parte. */
const OPERACIONAL: readonly PlanCapability[] = [
  PlanCapability.CUSTOMERS,
  PlanCapability.OPERATIONS,
  PlanCapability.FIELD_OPERATIONS,
  PlanCapability.EQUIPMENT,
  PlanCapability.PMOC,
  PlanCapability.RVT,
  PlanCapability.ARTIFACTS,
  PlanCapability.DOCUMENT_TEMPLATES,
  PlanCapability.CUSTOMER_PORTAL,
  PlanCapability.CUSTOMER_SERVICE_REQUESTS,
  PlanCapability.AUTOMATIONS,
  PlanCapability.ANALYTICS,
  PlanCapability.INTEGRATIONS,
];

/** A camada de inteligência, que só dois planos compram. */
const INTELIGENCIA: readonly PlanCapability[] = [
  PlanCapability.ORBIT_INTELLIGENCE,
  PlanCapability.AI_ASSISTANTS,
];

const alocacao = (
  businessUnits: PlanLimit,
  platformUsers: PlanLimit,
  fieldTechnicians: PlanLimit,
  auxiliaryTechnicians: PlanLimit,
  customers: PlanLimit,
  equipment: PlanLimit,
): Record<AllocationResource, PlanLimit> => ({
  [AllocationResource.BUSINESS_UNITS]: businessUnits,
  [AllocationResource.PLATFORM_USERS]: platformUsers,
  [AllocationResource.FIELD_TECHNICIANS]: fieldTechnicians,
  [AllocationResource.AUXILIARY_TECHNICIANS]: auxiliaryTechnicians,
  [AllocationResource.ACTIVE_CUSTOMERS]: customers,
  [AllocationResource.ACTIVE_EQUIPMENT]: equipment,
});

const uso = (
  serviceOrders: PlanLimit,
  pmoc: PlanLimit,
  rvt: PlanLimit,
  outros: PlanLimit,
  automacoes: PlanLimit,
  ai: PlanLimit,
): Record<UsageResource, PlanLimit> => ({
  [UsageResource.SERVICE_ORDERS_CREATED]: serviceOrders,
  [UsageResource.PMOC_DOCUMENTS_ISSUED]: pmoc,
  [UsageResource.RVT_DOCUMENTS_ISSUED]: rvt,
  [UsageResource.OTHER_DOCUMENTS_ISSUED]: outros,
  [UsageResource.AUTOMATION_RUNS]: automacoes,
  [UsageResource.AI_COMPUTE]: ai,
});

/**
 * `AI_COMPUTE` ainda não tem teto comercial.
 *
 * A unidade — chamada, token, custo — é decisão de negócio que ainda não foi
 * tomada, e inventar um número agora seria congelar a escolha errada. O que
 * existe é medição: os planos com inteligência contabilizam consumo sem
 * barrar, e os sem inteligência já são barrados pela **capacidade**, que é o
 * portão certo. Quando a unidade existir, só este valor muda.
 */
const AI_SEM_TETO = UNLIMITED;

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    code: PlanCode.ESSENTIAL,
    label: 'Essencial',
    description:
      'A operação completa para quem está começando a organizar o campo.',
    monthlyPrice: '59.90',
    capabilities: OPERACIONAL,
    allocation: alocacao(
      limited(1),
      limited(5),
      limited(5),
      limited(5),
      limited(150),
      limited(500),
    ),
    usage: uso(
      limited(500),
      limited(1_000),
      limited(1_000),
      limited(2_000),
      limited(1_000),
      limited(0),
    ),
  },
  {
    code: PlanCode.PROFESSIONAL,
    label: 'Profissional',
    description: 'Mais unidades, mais equipe e mais volume mensal.',
    monthlyPrice: '149.90',
    capabilities: OPERACIONAL,
    allocation: alocacao(
      limited(3),
      limited(20),
      limited(20),
      limited(20),
      limited(1_000),
      limited(5_000),
    ),
    usage: uso(
      limited(5_000),
      limited(10_000),
      limited(10_000),
      limited(20_000),
      limited(10_000),
      limited(0),
    ),
  },
  {
    code: PlanCode.PROFESSIONAL_INTELLIGENCE,
    label: 'Profissional + Inteligência',
    description:
      'O Profissional com a camada de inteligência do Orbit habilitada.',
    monthlyPrice: '249.90',
    capabilities: [...OPERACIONAL, ...INTELIGENCIA],
    allocation: alocacao(
      limited(3),
      limited(20),
      limited(20),
      limited(20),
      limited(1_000),
      limited(5_000),
    ),
    usage: uso(
      limited(5_000),
      limited(10_000),
      limited(10_000),
      limited(20_000),
      limited(10_000),
      AI_SEM_TETO,
    ),
  },
  {
    code: PlanCode.ENTERPRISE_UNLIMITED,
    label: 'Empresarial Ilimitado',
    description: 'Sem tetos operacionais, com inteligência incluída.',
    monthlyPrice: '699.90',
    capabilities: TODAS_AS_CAPACIDADES,
    allocation: alocacao(
      UNLIMITED,
      UNLIMITED,
      UNLIMITED,
      UNLIMITED,
      UNLIMITED,
      UNLIMITED,
    ),
    usage: uso(
      UNLIMITED,
      UNLIMITED,
      UNLIMITED,
      UNLIMITED,
      UNLIMITED,
      AI_SEM_TETO,
    ),
  },
];
