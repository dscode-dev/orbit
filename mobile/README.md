# Orbit Operator — Mobile PR-01

Aplicativo de campo do Orbit Operations ERP. Flutter 3.44, Dart 3.12, Material 3
com tema próprio.

Consome **os endpoints reais do NestJS**. Nenhum mock, dado demo ou regra
inventada — o que não existe no backend está listado na seção 8.

---

## 1. Executar

```bash
cd mobile
flutter pub get

# Emulador Android (10.0.2.2 = localhost da máquina)
flutter run --dart-define=ORBIT_API_URL=http://10.0.2.2:3001

# Simulador iOS
flutter run --dart-define=ORBIT_API_URL=http://localhost:3001

# Produção
flutter build apk --dart-define=ORBIT_API_URL=https://api.orbit.app \
                  --dart-define=ORBIT_FLAVOR=production
```

A URL nunca é constante de código: chega por `--dart-define` e é lida em
`core/config/environment.dart`.

---

## 2. Arquitetura

```
lib/
  app/providers.dart          composição de dependências (Riverpod)
  core/
    config/                   ambiente por --dart-define
    contracts/                espelho dos DTOs do backend
    errors/                   OrbitException
    network/                  Dio + interceptors + renovação de sessão
    observability/            log sem dados sensíveis
    routing/                  GoRouter, shell por perfil, guards
    storage/                  tokens (seguro) e cache de leitura
    theme/                    tema Orbit
    widgets/                  marca e estados de seção
  features/
    authentication/  data · domain · application · presentation
    home/            data · application · presentation
    operations/      data · application · presentation
    scheduling/      data · presentation
    profile/         presentation
```

Uma feature tem até quatro camadas, e o sentido é sempre o mesmo:

```
presentation (widgets)  →  application (providers)  →  data (repository)  →  core/network
```

**Widget nunca faz HTTP.** Ele observa um provider; o provider chama um
repository; o repository usa o cliente central. Isso é o que permite testar
regra sem árvore de widgets e trocar transporte sem tocar em tela.

### Fluxo de uma requisição

```
Repository
  → OrbitApiClient
    → RequestContextInterceptor   x-request-id, accept-language, x-timezone
    → AuthInterceptor             Bearer do secure storage; 401 → renova → repete
    → LoggingInterceptor          método, rota, status, duração, requestId
    → ErrorMappingInterceptor     DioException → OrbitException
  → NestJS
```

O `x-request-id` que o app gera é o mesmo que o `RequestIdInterceptor` do
backend registra: um erro no aparelho é rastreável no log do servidor.

---

## 3. Sessão e renovação

Tokens vivem **apenas** no `flutter_secure_storage` (Keychain /
EncryptedSharedPreferences). Nunca em `SharedPreferences`, nunca no cache de
leitura, nunca em log.

O backend **rotaciona o refresh token a cada uso**. Isso torna a corrida de
renovação um problema real: a Home dispara seis requisições em paralelo e, se
cada 401 disparasse o próprio refresh, a primeira rotacionaria o token e as
demais chegariam com um token já consumido — derrubando a sessão sem motivo.

`core/network/session_authenticator.dart` resolve com duas proteções:

1. **Chamada única em voo** — requisições concorrentes aguardam a mesma
   `Future` em vez de chamarem `/identity/refresh` cada uma.
2. **Janela de rotação (15 s)** — quem chega logo depois da rotação, ainda com o
   token antigo, recebe o par recém-emitido.

Coberto por teste: cinco 401 simultâneos → **uma** chamada ao backend.

Falha real de renovação limpa o armazenamento e emite `onExpired`; o
`AuthController` escuta e a navegação volta para o login.

### Restauração ao abrir

`restore()` lê as claims do token guardado e monta a sessão sem validar na
rede. Se o token estiver vencido, a primeira requisição dispara a renovação
pelo interceptor. O app abre rápido mesmo com rede ruim.

---

## 4. Perfis

O perfil é **derivado das permissões do backend**, não de configuração local:
quem tem `operations.manage` recebe a experiência de gestão; os demais, a de
execução.

| | Operator | Owner |
| --- | --- | --- |
| Aba 1 | Início | Visão Geral |
| Home | próprias operações, agenda do dia, alertas | KPIs do Analytics, volumes da unidade, prazo vencido, agenda, alertas |
| Operações | filtradas por `assignedUserId` | filtradas pela unidade ativa |
| Transição de status | conforme permissão | conforme permissão |

A interface esconde o que o backend recusaria (`PermissionGate`), mas **nunca
substitui a validação do servidor**.

---

## 5. Endpoints consumidos

| Endpoint | Uso |
| --- | --- |
| `POST /identity/login` | autenticação (`client: MOBILE`) |
| `POST /identity/refresh` | renovação com rotação |
| `POST /identity/logout` | encerramento de sessão |
| `GET /identity/me` | perfil |
| `GET /organizations/current` | organização, plano e unidades |
| `GET /organizations/current/subscription` | capabilities e status da assinatura |
| `GET /operations` | listagem, filtros e contagens por status |
| `GET /operations/:id` | detalhe (cliente, ativo, equipe, anexos, checklists) |
| `GET /operations/:id/timeline` | linha do tempo |
| `GET /operations/:id/history` | auditoria |
| `PATCH /operations/:id/status` | transição de status |
| `GET /checklist-executions?operationId=` | checklists da operação |
| `GET /scheduling/agenda` | agenda do dia |
| `GET /analytics/dashboard` | KPIs do Owner |
| `GET /notifications` | alertas não lidos |

**Nenhuma métrica é calculada no app.** Onde há número, ou veio de um Read
Model do Analytics, ou é o `meta.total` que o backend devolveu ao contar a
própria consulta.

A máquina de estados da operação também não é replicada: o app oferece os
status e apresenta a recusa do backend quando a transição é inválida.

---

## 6. Offline (somente leitura)

Listas de operações, detalhes e agenda já consultados ficam em cache. Sem rede,
a tela abre com o último conteúdo e exibe `StaleDataBanner` dizendo há quanto
tempo o dado foi salvo.

Limites desta PR, deliberados:

- **sem mutação offline** — escrever exige rede;
- **sem fila de sincronismo** — fica para a próxima PR;
- **403 não cai para o cache** — recusa de acesso precisa ser vista;
- **nada sensível em cache** — tokens só no armazenamento seguro.

A interface `ReadCache` é o ponto de extensão: trocar a implementação por uma
com fila não muda quem a consome.

---

## 7. Qualidade

```bash
flutter analyze                    # sem issues
flutter test                       # 42 testes
flutter build apk --debug          # ok
flutter build ios --no-codesign    # ok
```

| Arquivo | O que garante |
| --- | --- |
| `session_authenticator_test` | corrida de renovação, janela de rotação, expiração |
| `orbit_api_client_test` | envelope, erros, request-id, token, 401 → refresh → repete |
| `auth_controller_test` | login, restauração, logout, perfis, admin sem tenant, troca de unidade |
| `operations_repository_test` | contratos, filtros aceitos, cache offline, 403, conflito de transição |
| `login_screen_test` | validação, erro do backend, MFA sob demanda |
| `operations_screen_test` | lista, vazio, offline, acesso negado, filtro |
| `orbit_logger_test` | ausência de segredo em log |

---

## 8. Ausente por falta de suporte no backend

Nada aqui foi contornado com mock.

### 8.1 Anexar evidências pelo aplicativo

`POST /operations/:id/attachments` existe e aceita `multipart/form-data`. O que
falta é do lado do app: captura de câmera e seleção de arquivo exigem
`image_picker`/`file_picker` e permissões de câmera e galeria nos dois
sistemas. Ficou fora do escopo desta PR; os anexos existentes **são listados**
no detalhe.

### 8.2 Preencher checklist

`PATCH /checklist-executions/:id/answers`, `/complete` e `/cancel` existem. O
preenchimento exige um formulário dinâmico dirigido por
`templateSnapshot.items` (tipos, obrigatoriedade, opções) — trabalho de um
módulo próprio. Esta PR **mostra** os checklists e o progresso calculado pelo
backend.

### 8.3 Ordenação da listagem

`OperationQueryDto` não aceita parâmetro de ordenação; o backend ordena por
`scheduledStart asc, createdAt desc`. Ordenar no cliente reordenaria apenas a
página atual e daria impressão falsa de ordem global — o controle não é
oferecido.

### 8.4 Atribuir técnico

`POST /operations/:id/assignments` exige um `userId`, mas não há endpoint que
liste os membros do tenant (`/identity/me` cobre só o próprio usuário,
`/platform-admin/users` é global e restrito ao administrador da plataforma).
Sem essa fonte, o campo seria um input de UUID cru. Falta no backend:
`GET /organizations/current/members` ou equivalente.

### 8.5 "Operações atrasadas" como métrica

Não existe filtro de atraso. O que existe é `scheduledTo`, que recorta pela
janela de agendamento. Combinado com `status=SCHEDULED`, o **servidor** conta o
que venceu — é o que o cartão "Prazo vencido" mostra. Um indicador de atraso
propriamente dito precisaria vir do Analytics.

### 8.6 Severidade de alertas

O modelo `Notification` tem `type` e `status`, não severidade. O app apresenta
o que existe e destaca o não lido, sem inventar gravidade.

### 8.7 Troca de organização

O backend deriva a organização das claims do token e não expõe endpoint para
listar as organizações do usuário nem para trocar a ativa. A troca de
**unidade** funciona (é filtro real das consultas); a de organização não foi
implementada.

---

## 9. Identidade visual

O símbolo foi **extraído** da logomarca oficial (`orbit_logo.png`) por chave
cromática — o fundo cinza da fotografia é neutro (B−R ≈ 6) e todo o símbolo é
azul (B−R ≥ 44), o que permite separar sem redesenhar. O resultado está em
`assets/brand/orbit-symbol.png` e alimenta ícone, splash, tela de autenticação
e cabeçalho.

**Limitação conhecida:** o arquivo de origem é a fotografia de uma placa
luminosa, e o brilho está gravado nos próprios pixels da marca. Nenhum limiar
separa "brilho" de "geometria", porque ambos são azuis. Em tamanho de ícone o
halo aparece como um leve borrão ao redor do símbolo.

Para um ícone limpo é necessário o **arquivo original do símbolo** — SVG, ou
PNG com fundo transparente e sem o brilho. Basta substituir
`assets/brand/orbit-symbol.png` e regerar os ícones; é o único ponto de troca.

Paleta (`core/theme/orbit_theme.dart`): azul céu profundo `#0B162C`, gradiente
`#2F6BFF → #8B5CF6`, superfícies translúcidas, bordas suaves. Tema escuro por
padrão — o app é usado sob sol forte, onde o escuro tem melhor contraste, e os
alvos de toque respeitam 48dp por causa das luvas.

---

## 10. Adicionar uma feature nova

1. `lib/features/<nome>/` com `data/`, `application/`, `presentation/`.
2. **Contrato** em `core/contracts/` espelhando o DTO real do backend.
3. **Repository** em `data/`, usando `OrbitApiClient` — nunca Dio direto.
4. **Providers** em `application/`, um por leitura, para que cada seção
   recarregue sozinha.
5. **Telas** em `presentation/`, consumindo providers e usando `SectionCard`,
   `SectionLoading`, `SectionEmpty`, `SectionError`.
6. Registre o repository em `app/providers.dart` e a rota em
   `core/routing/orbit_router.dart`.
7. Ações restritas dentro de `PermissionGate`.
8. Testes: repository com `ScriptedAdapter`, tela com `ProviderScope`
   sobrescrevendo o repository.

O que **não** fazer: HTTP em widget, regra de negócio no app, token fora do
armazenamento seguro, número calculado localmente, máquina de estados
replicada do backend.

---

## 11. Decisões técnicas

**Sem `freezed`/`json_serializable`.** A stack os prevê "quando fizer sentido".
São ~15 classes de contrato, estáveis e simples; escrevê-las à mão mantém o
build sem `build_runner` e sem arquivos gerados no controle de versão. Se os
contratos crescerem, a migração é local aos arquivos de `core/contracts/`.

**Cliente HTTP separado para renovação e reexecução.** O `AuthInterceptor`
usaria a si mesmo ao repetir a requisição, entrando em recursão. Um segundo
`Dio` sem esse interceptor evita o laço — é por isso que `OrbitApiClient.create`
monta dois clientes.

**`QueuedInterceptor` no auth.** Serializa o tratamento de 401 dentro do Dio,
complementando a deduplicação do `SessionAuthenticator`.
