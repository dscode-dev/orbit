# PR-05 Assets / PR-06 CRM

## Assets

Assets possuem escopo obrigatório de organização e unidade de negócio. O
identificador é um payload agnóstico ao meio físico e pode ser usado como:

- `QR_CODE`;
- `NFC`;
- `INTERNAL_CODE`;
- serial, código de barras, RFID ou identificador customizado.

`GET /assets/resolve/:identifier` é o contrato reutilizável para leitores,
aplicativos móveis e para a futura criação de Operações. O backend não gera a
imagem do QR nem grava uma tag NFC; ele mantém e resolve o payload canônico.

Endpoints:

- `GET /assets`
- `GET /assets/:id`
- `GET /assets/resolve/:identifier`
- `POST /assets`
- `PATCH /assets/:id`
- `DELETE /assets/:id`

## Customers e Contacts

Customers são organizacionais. Contacts pertencem ao customer e podem ser
globais na organização ou restritos a uma business unit. Ao promover um contato
como principal, o principal anterior é removido na mesma transação.

Endpoints:

- `GET /customers`
- `GET /customers/:id`
- `POST /customers`
- `PATCH /customers/:id`
- `DELETE /customers/:id`
- `GET /customers/:id/contacts`
- `POST /customers/:id/contacts`
- `PATCH /customers/:id/contacts/:contactId`
- `DELETE /customers/:id/contacts/:contactId`

## Segurança

Todos os endpoints exigem plano ativo, capabilities e permissions. Repositories
executam dentro de `RlsTransaction`; Assets respeitam as unidades acessíveis no
JWT e Contacts seguem o escopo opcional por unidade definido na policy existente.

## Migration

`20260731010000_pr05_assets_pr06_crm_constraints` adiciona unicidade para
registros ativos, checks de identificadores/datas e capabilities. A migration foi
criada, mas não aplicada.
