# Artifact Execution Engine

## Limite do módulo

O motor instancia e registra a execução operacional de qualquer
`ArtifactTemplate`. Ele não gera PDF, não renderiza documentos, não processa
mídia e não é um Workflow Engine. `Report`, `ChecklistExecution` e suas APIs
legadas permanecem disponíveis, mas novas execuções genéricas usam este
agregado canônico.

## Artifact Snapshot

Na criação, o repository lê uma `ArtifactTemplateVersion` imutável e, na mesma
transação, copia metadata, seções, campos/regras, assinaturas e layout para um
`ArtifactSnapshot`. Também grava chave, nome, classificação, versão e SHA-256
da estrutura. A execução referencia esse snapshot, nunca consulta o template
vigente para interpretar campos. Alterar, desativar ou versionar o template
não modifica uma execução existente.

```text
ArtifactTemplate -> ArtifactTemplateVersion -> ArtifactSnapshot -> ArtifactExecution
```

## Agregado

`ArtifactExecution` é a raiz. Organização e unidade são obrigatórias;
operação, cliente e ativo são referências tenant-validadas. Responsável,
equipe, agenda, datas operacionais, contexto e auditoria pertencem à execução.
Respostas, anexos, assinaturas e insights não são acessados fora dela.

### Máquina de estados

```text
DRAFT -> IN_PROGRESS <-> PAUSED
                    -> UNDER_REVIEW -> APPROVED -> COMPLETED -> ARCHIVED
                          |               |
                          +-> IN_PROGRESS <-+
DRAFT/PAUSED -----------------------------------------------> ARCHIVED
```

O backend valida cada transição. Envio para revisão e conclusão exigem todos
os campos obrigatórios e assinaturas obrigatórias. Estados em revisão,
aprovados, concluídos e arquivados não aceitam respostas ou mudanças
estruturais na execução.

## Respostas e progresso

Uma resposta é identificada por `(executionId, sectionId, fieldId)` e armazena
valor JSON, tipo e validações copiados do Snapshot, unidade, procedência
(`USER`, `SENSOR`, `IMPORT`, `SYSTEM`, `AI`), observações e ator. O motor apenas
persiste as validações nesta PR; não interpreta regras condicionais.

O progresso considera campos visíveis respondidos, campos obrigatórios
pendentes, seções integralmente respondidas e assinaturas obrigatórias ativas.
O valor persistido e o detalhamento público são calculados exclusivamente no
backend.

## Anexos, assinaturas e Intelligence

Anexos podem apontar para execução, seção ou resposta e registram descritor de
storage, tamanho, MIME, checksum e metadata para imagem, vídeo ou documento.
Upload/transcoding ficam para infraestrutura futura. Assinaturas só podem
ocupar slots existentes no Snapshot; dados, consentimento, localização e hash
são armazenados, sem validar ou gerar documento final.

`ArtifactExecutionInsight` é o ponto de integração futuro para alertas,
inconsistências, recomendações e observações automáticas. Nenhum agente é
executado nesta PR.

## API v1

- `GET/POST /api/v1/artifact-executions`
- `GET/PATCH /api/v1/artifact-executions/:id`
- `PATCH /api/v1/artifact-executions/:id/status`
- `PUT /api/v1/artifact-executions/:id/responses`
- `POST /api/v1/artifact-executions/:id/attachments`
- `POST /api/v1/artifact-executions/:id/signatures`
- `GET /api/v1/artifact-executions/:id/progress`

Todas exigem plano ativo, capability e RBAC. `RlsTransaction` e policies SQL
isolam organização e unidades permitidas. Mappers publicam apenas Read Models.

## Lacunas deliberadas para o futuro Document Engine

- composição do conteúdo final a partir do Snapshot e das respostas;
- renderização, paginação, fontes, logos e blocos reutilizáveis;
- geração e armazenamento de PDF/outros formatos;
- hash do documento final e vínculo das assinaturas ao binário gerado;
- validação visual/criptográfica e versionamento do documento gerado;
- política de regeneração após aprovação e retenção legal.

A migration `20260801230000_pr18_artifact_execution_engine` é aditiva e inclui
RLS, capabilities e permissões. Deve ser aplicada pelo operador; não é
executada pela implementação.
