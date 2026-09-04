# Ambiente dos testes de navegador

Os testes de `e2e/` correm contra o produto de verdade: Next em modo de
produção, API NestJS, PostgreSQL com RLS e o storage local. Não há mocks, e não
há `webServer` no `playwright.config.ts` — os serviços sobem antes.

Nenhuma credencial aparece aqui. O que este documento descreve é **onde** cada
serviço atende e por que os endereços precisam concordar entre si.

## Os quatro endereços

| Serviço   | Onde os testes esperam            | Variável          |
| --------- | --------------------------------- | ----------------- |
| Frontend  | `http://127.0.0.1:3000`           | `ORBIT_WEB_URL`   |
| API       | `http://localhost:6001/api/v1`    | `ORBIT_API_URL`   |
| Postgres  | atrás da API                      | —                 |
| Storage   | a mesma origem da API             | —                 |

O `globalSetup` verifica os quatro antes do primeiro teste e falha com o motivo
quando algum não responde. É deliberado: um endereço de storage inalcançável
derrubava quinze testes de RVT em cascata, e o diagnóstico não estava no erro.

## A porta da API é uma decisão só

O `docker-compose.yml` publica a API em `${API_PORT}` e mapeia para a porta
interna `5001`. Duas coisas precisam seguir essa mesma variável:

- o que os testes usam para falar com a API (`ORBIT_API_URL`);
- o que a **API** publica como endereço de download e upload
  (`STORAGE_LOCAL_PUBLIC_URL`).

O segundo apontava para `5001` fixo enquanto o primeiro seguia `API_PORT`. O
resultado: a API devolvia um endereço assinado com a porta interna do container,
que o host não alcança, e o upload do smoke de RVT falhava com `ECONNREFUSED`.
O `docker-compose.yml` agora deriva os dois da mesma variável.

## Postgres

O serviço vive na rede interna do compose. Quando for preciso alcançá-lo do
host — para uma consulta de leitura, nunca para alterar dados de teste —, use a
ponte que o laboratório já publica em vez de expor o container.

## Subir e rodar

```bash
docker compose up -d postgres api
cd frontend && npm run build && npm run start   # produção, porta 3000
npx playwright test
```

## O que os testes não fazem

- **Não apagam** o que criaram. Operação, cliente e plano têm histórico e
  auditoria; remover por SQL falsearia o estado do tenant.
- **Não alteram dados por SQL.** Todo estado de partida é montado pelos
  endpoints reais, os mesmos que a tela usa.
- **Não procuram "o primeiro registro que casar".** Cada cenário cria o que vai
  usar e guarda o identificador — ver `e2e/provision.ts`.
