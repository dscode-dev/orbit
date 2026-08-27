# PMOC V2 — configuração, ciclos e execução por equipamento

## Modelo e invariantes

O PMOC V2 separa três fatos que antes estavam condensados em `PmocExecution`:

```text
PmocPlan (configuração)
  └─ PmocExecution / ciclo (agenda e conformidade)
       └─ PmocEquipmentExecution (manutenção física de um equipamento)
            ├─ Operation 1:1
            ├─ PmocEquipmentEvidence 0..6
            └─ ArtifactExecution 0..1
```

`PmocExecution` continua com o mesmo nome físico para preservar contratos e
histórico, mas seu significado é exclusivamente ciclo. Os campos legados
`operation_id` e `artifact_execution_id` permanecem consultáveis e não são
copiados: em planos com mais de um equipamento seria impossível determinar o
destino correto sem inventar informação.

Configurar, editar ou ativar um plano nunca cria OS, ArtifactExecution, arquivo
ou renderização. A ativação cria atomicamente somente o primeiro ciclo e seu
evento de agenda. A agenda é do ciclo; equipamentos cobertos não geram eventos.

## Preparação e início

`GET /api/v1/pmoc/plans/:planId/cycles/:cycleId/equipment/:assetId/execution-preparation`
é o contrato autoritativo para Web e Mobile. Ele resolve plano, ciclo, cliente,
equipamento, procedimento, responsável técnico, técnicos elegíveis, política de
evidências/documento, bloqueios e ações permitidas. O cliente não envia esses
dados de volta como verdade.

O início recebe apenas responsável de campo e auxiliares. Na mesma transação,
sob trava e `UNIQUE(cycle_id, coverage_id)`, cria uma única execução física e
uma única `Operation`. Responsável e auxiliares reutilizam o modelo da PR-28.
O procedimento e o responsável técnico (inclusive versão/hash da assinatura)
são snapshots; mudanças posteriores no plano não alteram a execução.

O responsável técnico precisa estar habilitado pelo perfil profissional da
PR-27, no escopo da unidade, autorizado a assinar PMOC e possuir assinatura
ativa. O técnico de campo é uma função distinta e nunca recebe automaticamente
a assinatura do documento.

## Evidências, conclusão e rollover

Evidências apontam para `StorageFile` do mesmo tenant e para exatamente uma
execução física. A trava por execução torna o limite de seis seguro sob
concorrência. Não há processamento de mídia neste domínio.

`performedAt` é o instante real da manutenção e não é derivado de `dueOn`. A
conclusão do último equipamento resolvido trava o ciclo e, na mesma transação,
fecha o ciclo, atualiza a conformidade do plano e cria no máximo um próximo
ciclo. O próximo compromisso permanece no Scheduling no nível do ciclo.

## Compatibilidade e migração

- tabelas e endpoints antigos não foram removidos;
- ciclos antigos recebem `sequence_number` determinístico;
- o responsável legado só é promovido quando já satisfaz inequivocamente o
  perfil `TECHNICAL_RESPONSIBLE`; os demais permanecem legados;
- vínculos antigos de OS/documento permanecem no ciclo e não são reinterpretados;
- tabelas novas têm RLS habilitada e forçada, com tenant e unidade conferidos;
- a migration é entregue, mas não é aplicada automaticamente.

## API pública adicionada

- `GET .../cycles/:cycleId/equipment-executions`
- `GET .../cycles/:cycleId/equipment/:assetId/execution-preparation`
- `POST .../cycles/:cycleId/equipment/:assetId/executions`
- `POST .../cycles/:cycleId/equipment-executions/:executionId/complete`
- `POST /api/v1/pmoc/equipment-executions/:executionId/evidence`
- `POST /api/v1/pmoc/equipment-executions/:executionId/artifact`

O ArtifactExecution/PDF só pode ser associado depois de existir execução física
real. A geração e assinatura final continuam pertencendo ao Artifact/Document
Engine; esta PR prepara o vínculo e congela a política signatária.
