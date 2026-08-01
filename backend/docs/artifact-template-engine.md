# Artifact Template Engine

## Decisão arquitetural

Antes do PR-17, a estrutura de artefatos estava dividida entre
`ReportTemplate` (orientado a renderização/PDF) e `ChecklistTemplate`
(orientado a execução). Os dois armazenavam seções, campos ou assinaturas de
formas diferentes. O `ArtifactTemplate` passa a ser a definição estrutural
canônica; geração e execução continuam fora deste módulo.

A migração preserva dados e compatibilidade: cria um agregado canônico para
cada raiz lógica legada, converte cada versão existente em
`ArtifactTemplateVersion` e liga a linha legada por `artifactTemplateId`.
Endpoints antigos não foram removidos. Novos Execution e Document Engines
devem consumir somente o agregado canônico; os modelos antigos são uma ponte
de leitura/transição, não uma base para novos tipos.

## Agregado e versionamento

- `ArtifactTemplate` contém identidade e metadados mutáveis: chave, nome,
  classificação, segmento, visibilidade, tags, ordenação, estado e ponteiro
  `currentVersion`.
- `ArtifactTemplateVersion` é imutável e contém metadata, seções, campos,
  assinaturas e layout. Uma alteração estrutural usa `POST /:id/versions` e
  cria o próximo número sob lock transacional.
- Ativar/desativar ou alterar metadados não reescreve versões.
- Uma futura execução deve persistir `templateId` e `version`; assim permanece
  ligada à estrutura usada naquele momento, mesmo depois de novas versões.
- Exclusão é lógica, exige desativação e é recusada enquanto houver vínculo
  legado. Versões antigas continuam consultáveis.

## Estrutura configurável

Seções e campos ficam em JSON versionado porque constituem uma linguagem de
metadados, não tabelas operacionais. O validator verifica apenas invariantes
estruturais: IDs e ordens únicos e conteúdo serializável. Ele deliberadamente
não interpreta tipo, validação, dependência ou expressão condicional.

Cada seção publica identificação, título, descrição, ordem, tipo,
obrigatoriedade, visibilidade, permissões, colapso, configuração e campos.
Cada campo publica tipo livre, valores e flags, validações, dependências,
expressão condicional, placeholder, máscara, unidade e configuração. Slots de
assinatura carregam um `signerRole` livre; operador, cliente, responsável
técnico ou qualquer papel futuro não exige enum em código. O layout reserva
cabeçalho, rodapé, logomarca, paginação, numeração, identidade visual e blocos
reutilizáveis, sem renderizá-los.

### Como criar um novo tipo

Envie uma classificação estável em `artifactType`, tipos livres nas seções e
campos e toda configuração necessária no payload. Exemplo: um certificado
com sensor específico pode usar `artifactType: CERTIFICATE` e
`field.type: CALIBRATION_SENSOR`; repository, service e schema não mudam.
Somente o futuro interpretador precisa registrar um handler caso o tipo tenha
comportamento executável ou de renderização.

## Segurança e tenancy

- Todas as consultas passam por `RlsTransaction`.
- Policies PostgreSQL permitem ao tenant ver/escrever apenas sua organização.
- Templates `GLOBAL` ativos podem ser lidos por tenants e só são mutáveis no
  contexto de plataforma; a API tenant os trata como read-only.
- Rotas exigem plano ativo, capabilities `artifact_templates.read/manage` e
  permissões RBAC granulares.
- Cada criação, alteração, versão, status, duplicação e exclusão grava
  `AuditLog` com ator e organização.

## API pública v1

| Método | Rota | Resultado |
| --- | --- | --- |
| GET | `/api/v1/artifact-templates` | lista paginada tenant + globais ativos |
| POST | `/api/v1/artifact-templates` | agregado em draft e versão 1 |
| GET/PATCH/DELETE | `/api/v1/artifact-templates/:id` | consulta/metadados/exclusão lógica |
| GET/POST | `/api/v1/artifact-templates/:id/versions` | histórico/nova versão imutável |
| GET | `/api/v1/artifact-templates/:id/versions/:version` | versão histórica |
| POST | `/api/v1/artifact-templates/:id/activate` | ativa |
| POST | `/api/v1/artifact-templates/:id/deactivate` | desativa |
| POST | `/api/v1/artifact-templates/:id/duplicate` | cópia tenant em draft v1 |

Durante a janela do PR-16, os mesmos caminhos sem `/api/v1` permanecem como
aliases legados. Controllers nunca retornam objetos Prisma: o mapper publica
`ArtifactTemplateListItemReadModel`, `ArtifactTemplateReadModel`,
`ArtifactTemplateVersionReadModel` e os modelos aninhados de seção, campo,
assinatura e layout.

## Web e Mobile

O web sincroniza o Read Model TypeScript a partir do backend com
`npm run contracts:sync`. Flutter possui parsers tolerantes a campos aditivos
em `artifact_template_contracts.dart`. Ambos consomem o envelope v1 existente;
nenhuma regra de frontend ou dependência de framework cliente existe no motor.

## Migração

O arquivo `20260801220000_pr17_artifact_template_engine/migration.sql` cria,
converte, relaciona, configura RLS e concede capabilities/permissões. Ele deve
ser revisado e aplicado pelo operador da plataforma; a implementação do PR-17
não o executa automaticamente.
