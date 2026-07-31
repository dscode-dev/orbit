# PR-08 / PR-09 — Document Engine

## Modelo de integridade

O pipeline usa três hashes distintos:

- `Report.contentHash`: hash canônico do snapshot do template, conteúdo,
  configurações e vínculos do relatório;
- `Signature.reportContentHash`: identifica exatamente o snapshot assinado;
- `GeneratedDocument.sha256`: hash dos bytes do PDF;
- `GeneratedDocument.sourceHash`: liga o PDF ao `contentHash` de origem.

Templates não têm estrutura alterada no mesmo registro. Mudanças em seções,
slots ou configurações criam uma nova versão. Reports guardam um snapshot
completo e continuam reproduzíveis mesmo que novas versões do template sejam
publicadas.

## ReportTemplate

Tipos de seção:

- `HEADING`
- `TEXT`, com interpolação `{{path.to.value}}`
- `KEY_VALUE`
- `TABLE`
- `PAGE_BREAK`

Slots de assinatura declaram chave, título, ordem, obrigatoriedade e tipo de
signatário (`USER`, `CUSTOMER`, `EXTERNAL`).

Endpoints:

- `GET /report-templates`
- `GET /report-templates/:id`
- `POST /report-templates`
- `POST /report-templates/:id/versions`
- `PATCH /report-templates/:id`
- `POST /report-templates/:id/preview`
- `DELETE /report-templates/:id`

## Reports e documentos

O fluxo padrão é `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`. A publicação só
ocorre por `finalize`, depois das assinaturas obrigatórias e da geração do PDF.
PDFs são imutáveis e recebem versão crescente por Report.

Endpoints:

- CRUD e filtros em `/reports`
- `PATCH /reports/:id/status`
- `POST /reports/:id/render`
- `POST /reports/:id/finalize`
- `GET /reports/:id/documents`
- `GET /reports/:id/documents/:documentId`

## Assinaturas

Assinaturas exigem consentimento explícito, evidência em base64, identidade,
data, IP, user-agent e hash. Assinaturas de Reports publicados são imutáveis.

Endpoints:

- `GET /reports/:reportId/signatures`
- `POST /reports/:reportId/signatures`
- `DELETE /reports/:reportId/signatures/:id`

## Armazenamento e RLS

PDFs ficam fora da área pública em `DOCUMENT_STORAGE_DIR`. O compose usa o
volume `generated_documents`. Download recalcula SHA-256 antes de entregar o
arquivo.

GeneratedDocument e Signature usam policies RLS herdadas do Report, incluindo
Business Unit. A migration foi criada, mas não aplicada.
