# VIVA — Seu plano, seu ritmo.

Aplicativo web (PWA) em português do Brasil para **planejar a alimentação da semana, treinar com segurança, comprar dentro do orçamento e manter hábitos** — com dados nutricionais reais (Tabela TACO), preços informados pela própria pessoa e uma gamificação que celebra constância, nunca restrição.

> Status: versão completa de desenvolvimento, verificada com typecheck, lint, testes unitários, de integração, ponta a ponta e de acessibilidade (axe), CI no GitHub Actions e imagem Docker testada (veja [Como rodar testes](#como-rodar-testes)). Ainda **não** passou por um deploy público, revisão jurídica nem auditoria externa de segurança/acessibilidade — veja [Limitações conhecidas](#limitações-conhecidas).

---

## Sumário

- [Problema que resolve](#problema-que-resolve)
- [Funcionalidades implementadas](#funcionalidades-implementadas)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Requisitos para executar](#requisitos-para-executar)
- [Instalação passo a passo](#instalação-passo-a-passo)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados: configuração e migrações](#banco-de-dados-configuração-e-migrações)
- [Executar em desenvolvimento](#executar-em-desenvolvimento)
- [Como rodar testes](#como-rodar-testes)
- [Como gerar o build](#como-gerar-o-build)
- [Como realizar deploy](#como-realizar-deploy)
- [Integrações externas e requisitos](#integrações-externas-e-requisitos)
- [Funcionalidades ainda não implementadas](#funcionalidades-ainda-não-implementadas)
- [Limitações conhecidas](#limitações-conhecidas)
- [Cuidados de segurança e privacidade (LGPD)](#cuidados-de-segurança-e-privacidade-lgpd)
- [Licenças e fontes dos dados](#licenças-e-fontes-dos-dados)

---

## Problema que resolve

Quem quer comer melhor e treinar com regularidade costuma espalhar a rotina em vários lugares: uma planilha de dieta, um app de treino, a lista de compras no papel e nenhuma noção de quanto aquilo custa. Os apps existentes frequentemente são em inglês, usam bases de alimentos estrangeiras, inventam metas calóricas, ignoram o orçamento e usam linguagem de culpa.

O VIVA junta essas peças num fluxo único e honesto:

- o **plano semanal** respeita alergias (críticas) e preferências (flexíveis), o tempo para cozinhar e a meta passada por um(a) nutricionista — sem inventar prescrições;
- a **lista de compras** sai do plano, já consolidada em embalagens reais, descontando a despensa e comparando com o orçamento;
- os **preços** são sempre informados pela pessoa (manualmente, por planilha ou pelo valor pago) e exibem origem e data — o app nunca inventa preço;
- o **treino** é registrado série a série, com histórico e evolução, sem aumentos automáticos de carga;
- a **gamificação** premia constância e organização; descanso nunca é punido.

## Funcionalidades implementadas

**Conta e perfil**
- Cadastro e login por e-mail/senha, sessão segura, saída da conta, consentimentos versionados (termos de uso, política de privacidade e dados de saúde).
- Recuperação de senha por e-mail (link de uso único, válido por 60 minutos, que encerra as outras sessões), confirmação de e-mail e troca de senha no perfil. O envio usa SMTP e só aparece quando um provedor está configurado.
- Onboarding progressivo em 9 etapas (perfil, objetivo, rotina de treino, refeições e cozinha, gostos, alergias × preferências claramente separadas, orçamento por dia/semana/mês, meta do(a) nutricionista com período diário ou semanal, despensa), resumo e confirmação. Tudo editável depois em **Perfil**.
- Estimativa educativa de gasto energético (Mifflin-St Jeor, faixa ±10%, só no navegador e só para maiores de 18 anos) — nunca vira meta automaticamente.

**Alimentação**
- Base nutricional TACO (597 alimentos; 98 revisados com alérgenos, família e grupo de substituição), com estado (cru/cozido/pronto), fonte e campos ausentes sinalizados — valores nunca são estimados.
- Alimentos personalizados criados pela pessoa, com busca opcional pelo **código de barras no Open Food Facts**: nome, marca, nutrientes por 100 g e alergênicos/traços do rótulo vêm pré-preenchidos para conferência (campos ausentes ficam em branco).
- Ferramenta de **revisão de alergênicos** para nutricionistas (`npm run alergenos:exportar` / `alergenos:importar`): planilha com sugestões, gravação só com o nome de quem revisou, e o seed preserva as revisões.
- Planejador semanal (segunda a domingo): geração automática com versão anterior preservada, refeições com CRUD completo, ajuste de quantidades, substituição por equivalentes (mesmo nutriente principal, cru × cozido considerado), duplicação, troca por receita compatível, conclusão, refeição flexível sem linguagem de culpa, totais diários/semanais e avisos de dados incompletos.
- Registro de refeições fora do plano, histórico e despensa.
- 42 receitas com valores calculados a partir da TACO.

**Compras e orçamento**
- Lista consolidada a partir do plano, com conversão cozido→cru, embalagens (unidade, g, ml com densidade, granel em passos de 50 g), despensa descontada e sobras previstas.
- Custo consumido × custo da compra × valor pago; orçamento restante; status e origem de cada preço; marcar como comprado/pago; itens manuais; finalizar lista levando sobras à despensa.
- Cadastro de preços manual, importação por CSV (modelo em `/modelo-precos.csv`) e histórico; sugestões de economia por equivalentes mais baratos que respeitam restrições.
- **Preços da comunidade (Open Prices)**, opcional: hortifrúti a granel, preço por kg, em reais, de até 30 dias, sempre com loja, cidade, data e link de origem.

**Treino**
- Catálogo de 39 exercícios por grupo muscular, com passo a passo, erros comuns, cuidados e mapa corporal (sem vídeos falsos).
- Rotina sugerida a partir do perfil (A/B/C), editor de rotinas e treinos.
- Sessão com registro de séries, descanso com cronômetro, pausa/retomada, persistência ao recarregar, alertas de segurança, histórico, comparação com a sessão anterior e evolução por exercício. A progressão é apenas sugerida.

**Progresso e hábitos**
- Filtros de 7/30/90 dias ou período personalizado; consistência alimentar (calendário), treinos por semana, evolução de cargas, peso e medidas opcionais (com edição/exclusão), água por dia, gastos por lista e hábitos personalizados. O peso nunca é o único indicador.

**Gamificação**
- XP idempotente, níveis, mascote que cresce com o nível (nunca com peso), 13 conquistas e 6 desafios semanais opcionais e pausáveis, histórico de XP com a origem de cada ponto e celebrações desligáveis.
- Lembretes opcionais (refeição, água, treino, desafios) dentro do app e, se a pessoa ativar, por **notificação push** gratuita (Web Push), só no horário acordado e no máximo uma vez por dia por lembrete.

**Assistente**
- Ferramentas do VIVA (sem IA): trocar alimento, economizar na semana, refeição mais rápida, como fazer um exercício e o que falta comprar.
- Conversa com IA opcional (Claude, da Anthropic), apenas no servidor, com consentimento explícito, contexto mínimo visível antes do envio, resposta exibida enquanto é gerada (*streaming*), identificada como IA, e histórico apagável. Sem chave configurada, a conversa simplesmente não é oferecida — nada é simulado.

**Plataforma**
- Tema escuro (padrão), claro ou do sistema; redução de movimento; layout mobile-first com navegação inferior no celular e lateral no desktop.
- PWA instalável com ícones e página offline (dados não ficam em cache no aparelho, por privacidade).
- Exportação de todos os dados (JSON) e exclusão da conta.
- Content-Security-Policy com nonce por requisição, rota de saúde (`/api/saude`) e imagem Docker com `docker compose` (banco + migrações + app).

## Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Turbopack) e React 19 |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS 4 (tokens CSS em `globals.css`), fontes Bricolage Grotesque e Figtree (Fontsource), ícones Lucide |
| Banco | PostgreSQL + Prisma 7 (gerador `prisma-client`, adaptador `@prisma/adapter-pg`) |
| Autenticação | Better Auth (e-mail/senha, sessões em banco, rate limit em banco) |
| Validação | Zod 4 (mensagens em pt-BR) |
| IA (opcional) | SDK oficial `@anthropic-ai/sdk` (streaming) |
| E-mail (opcional) | Nodemailer (SMTP de qualquer provedor) |
| Notificações (opcional) | `web-push` (Web Push com chaves VAPID) |
| Dados abertos | Open Food Facts (código de barras) e Open Prices (preços da comunidade) |
| Testes | Vitest (unidade e integração), Playwright (ponta a ponta) e axe-core (acessibilidade) |
| Entrega | GitHub Actions (CI e agendador de lembretes), Docker (Next.js standalone) |

## Arquitetura

Monólito modular, com as regras de negócio separadas da interface:

```
Navegador ──► Next.js (RSC + Server Actions) ──► services (Prisma) ──► PostgreSQL
                      │                              │
                      └── domain/ (regras puras, sem I/O, testadas) ◄┘
```

- **`src/domain`** — regras puras em TypeScript, sem banco nem React: cálculo nutricional, motor de restrições (crítico × preferência), preços e embalagens, gerador do plano (determinístico por semente), substituições equivalentes, gamificação, treino, lembretes, contexto mínimo do assistente. É onde está a maior parte dos testes unitários.
- **`src/server/services`** — acesso a dados. Toda consulta é filtrada pelo `userId` da sessão; recursos de outro usuário retornam "não encontrado".
- **`src/server/actions`** — Server Actions (`"use server"`): sessão obrigatória, validação Zod, limites de frequência, chamada ao serviço e revalidação. Retornam `ActionResult` (sucesso, erro amigável, erros por campo, celebrações).
- **`src/app`** — páginas (Server Components) e rotas de API mínimas: autenticação, busca de alimentos, exportação de dados, conversa com IA em streaming (`/api/assistente`, com checagem de origem), lembretes agendados (`/api/cron/lembretes`, com segredo) e saúde (`/api/saude`).
- **`src/server/integrations`** e **`src/server/push`** — Open Food Facts, Open Prices (contrato `PriceProvider`), envio de e-mail e Web Push; cada um desligado quando não configurado.
- **`src/components`** — componentes de interface. `ActionForm` liga formulários às actions com erros acessíveis, toasts e celebrações.
- **`src/proxy.ts`** — aplica a Content-Security-Policy com nonce em todas as páginas e faz a verificação otimista de sessão nas áreas logadas (o antigo *middleware*); a autorização real acontece no servidor, em cada página e action.

Decisões técnicas relevantes:
- `cacheComponents` está **desativado**: quase todas as páginas são por usuário e mudam a cada ação, então a renderização dinâmica clássica é mais simples e previsível.
- Dinheiro em **centavos inteiros**; datas de calendário como `AAAA-MM-DD` (`@db.Date`); horários no fuso da pessoa (padrão `America/Sao_Paulo`); semanas começam na segunda.
- Alimentos cozidos são convertidos para o equivalente cru na lista de compras pelo balanço de matéria seca (umidade TACO).
- Actions que fazem a página atual sumir (finalizar treino, apagar conversa) navegam em vez de revalidar; o `ActionForm` dispara toast, celebração e fechamento de diálogo assim que a action responde, mesmo se a revalidação desmontar o formulário.
- O cliente do banco é criado no primeiro uso, então o build não precisa de `DATABASE_URL` nem de segredos (o job de imagem Docker no CI garante isso).

## Estrutura de pastas

```
├── prisma/
│   ├── schema.prisma          # modelo de dados
│   ├── migrations/            # migrações SQL versionadas
│   └── seed/                  # catálogo (TACO, receitas, produtos, exercícios, conquistas) e demo
├── public/                    # ícones do PWA, service worker, modelo de CSV
├── scripts/                   # conversão da TACO, revisão de alergênicos, chaves VAPID
├── .github/workflows/         # CI (testes + imagem) e agendador de lembretes push
├── Dockerfile  docker-compose.yml
├── src/
│   ├── app/                   # rotas (App Router)
│   │   ├── (auth)/            # entrar, criar conta
│   │   ├── (app)/             # área logada: início, alimentação, compras, treino, progresso, conquistas, assistente, perfil
│   │   ├── onboarding/  privacidade/  offline/  api/
│   │   └── layout.tsx, globals.css, manifest.ts
│   ├── components/            # UI (forms, ui, charts, brand, shell, planner, training…)
│   ├── domain/                # regras puras (nutrição, restrições, preços, plano, treino, gamificação…)
│   ├── lib/                   # validação, rótulos, tipos compartilhados
│   ├── server/                # auth, sessão, db, actions, services, ai, integrations
│   └── proxy.ts
├── tests/
│   ├── unit/                  # regras de domínio e validação
│   ├── integration/           # serviços contra o banco viva_test
│   ├── e2e/                   # 12 fluxos, recuperação de senha e acessibilidade (axe)
│   └── support/               # setup, fábricas, SMTP local e servidores simulados das APIs
├── playwright.config.ts  vitest.config.mts  next.config.ts  prisma.config.ts
└── .env.example
```

## Requisitos para executar

- Node.js **20.19 ou superior** (desenvolvido com Node 22).
- PostgreSQL **14 ou superior** (testado com 16).
- npm 10+.
- Para os testes E2E: navegador Chromium do Playwright (`npx playwright install chromium`).

## Instalação passo a passo

```bash
# 1. Dependências (gera o cliente Prisma no postinstall)
npm install

# 2. Variáveis de ambiente
cp .env.example .env
# edite .env: DATABASE_URL e BETTER_AUTH_SECRET são obrigatórios

# 3. Banco: crie o banco vazio e aplique as migrações
createdb viva                       # ou pelo seu provedor de PostgreSQL
npm run db:migrate

# 4. Catálogo (alimentos TACO, receitas, produtos, exercícios, conquistas, desafios)
npm run db:seed

# 5. (Opcional) conta de demonstração com plano, rotina e lista prontos
npm run db:seed:demo

# 6. Rodar
npm run dev                         # http://localhost:3000
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Conexão PostgreSQL. |
| `BETTER_AUTH_SECRET` | sim | Segredo das sessões (32+ bytes aleatórios). Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. |
| `BETTER_AUTH_URL` | sim | URL pública do app (em produção, `https://…`). |
| `ANTHROPIC_API_KEY` | não | Ativa a conversa com IA no assistente. Fica só no servidor. |
| `VIVA_AI_MODEL` | não | Modelo da IA (padrão `claude-opus-5-5`). |
| `VIVA_AI_MAX_PER_HOUR` | não | Perguntas à IA por usuário por hora (padrão 20, máximo 500). |
| `VIVA_PRIVACY_CONTACT` | não | Contato do encarregado de dados exibido em `/privacidade` e `/termos`. |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | não | Envio de e-mails (recuperação de senha e confirmação de e-mail) por SMTP. Sem eles, esses recursos ficam ocultos. |
| `EMAIL_TRANSPORT=console` | não | Só em desenvolvimento: mostra os e-mails no terminal em vez de enviar. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | não | Notificações push. Gere com `npm run push:chaves`. |
| `CRON_SECRET` | não | Segredo exigido por `/api/cron/lembretes` (`Authorization: Bearer …`). |
| `VIVA_OPEN_FOOD_FACTS` | não | `off` desliga a busca por código de barras (ligada por padrão). |
| `VIVA_OPEN_PRICES` | não | `on` ativa os preços da comunidade (desligado por padrão). |
| `NEXT_TELEMETRY_DISABLED` | não | Desativa a telemetria do Next.js. |
| `VIVA_DEMO_PASSWORD` / `VIVA_ALLOW_DEMO` | não | Apenas para o seed de demonstração. |
| `VIVA_DISABLE_AUTH_RATE_LIMIT` | não | Somente testes locais; nunca em produção. |

Os testes de integração e E2E leem `.env.test` (não versionado), que deve apontar para um banco **separado** chamado `viva_test`:

```dotenv
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/viva_test?schema=public"
BETTER_AUTH_SECRET="outro-segredo-aleatorio"
BETTER_AUTH_URL="http://localhost:3100"
```

## Banco de dados: configuração e migrações

- `npm run db:migrate` — aplica as migrações pendentes (`prisma migrate deploy`). Use em todos os ambientes.
- `npm run db:migrate:dev` — cria uma nova migração a partir de mudanças no `schema.prisma` (desenvolvimento).
- `npm run db:seed` — carrega/atualiza o catálogo. É idempotente (upserts por chave) e não toca em dados de usuários.
- `npm run db:seed:demo` — cria ou recria **apenas** a conta `demo@viva.local`. Os preços dessa conta têm origem "Exemplo de demonstração". Bloqueado em produção sem `VIVA_ALLOW_DEMO=1`.
- `npm run db:studio` — inspeção visual dos dados.

Antes de qualquer mudança destrutiva em produção (remover colunas, `migrate reset`), faça backup (`pg_dump`). O projeto nunca executa reset automaticamente.

## Executar em desenvolvimento

```bash
npm run dev          # servidor com hot reload em http://localhost:3000
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run check        # typecheck + lint + testes unitários
```

O service worker só é registrado em produção, para não interferir no hot reload.

## Como rodar testes

```bash
npm test                    # unitários (domínio e validação) — não precisam de banco
npm run test:integration    # serviços contra o banco viva_test (aplica migrações e seed automaticamente)
npm run test:e2e            # gera o build, sobe em :3100 com viva_test e roda os testes no Chromium
npm run test:all            # tudo acima
```

O CI (`.github/workflows/ci.yml`) roda typecheck, lint, unitários, integração e E2E com PostgreSQL 16 como serviço, e constrói a imagem Docker sem segredos.

Cobertura atual:
- **Unitários (132):** nutrientes por porção, somas diárias/semanais, metas semanais ÷ 7, conversão cru/cozido, embalagens e granel, custo consumido × compra, consolidação, orçamento, motor de restrições, substituições, gerador do plano, XP/níveis/conquistas/desafios, treino, lembretes, contexto mínimo da IA, validação de cotações e de entradas, Content-Security-Policy, modelos de e-mail, janela de horário das notificações, conversão Open Food Facts, escolha de cotação do Open Prices e sugestões de alergênicos.
- **Integração (42):** isolamento de dados entre usuários (plano, refeições, listas, medidas, hábitos, preços, exportação, exclusão em cascata), plano respeitando alergias, troca com alérgeno exigindo confirmação, lista consolidada → compra → despensa, treino registrado e recuperado, XP idempotente e conquistas persistentes, metas implausíveis recusadas, importação CSV, cotações de integração, falhas e streaming da IA (sem chave, recusa, 401, 429, 500, provedor fora do ar, recusa no meio do streaming), segurança da rota do assistente (origem e sessão), recuperação de senha e confirmação de e-mail com servidor SMTP local, Web Push real (criptografia aes128gcm e assinatura VAPID) contra um serviço de push local em HTTPS, Open Food Facts e Open Prices contra servidores locais nos formatos das especificações oficiais, e a planilha de revisão de alergênicos.
- **E2E (16):** os 12 fluxos — criar conta e entrar; completar o onboarding; criar um planejamento semanal; editar uma refeição; substituir um ingrediente; gerar a lista de compras; marcar produtos como comprados; registrar um treino; desbloquear uma conquista; consultar o histórico; recarregar e recuperar os dados; sair e entrar novamente —, sem erros nem violações de CSP no navegador; recuperação de senha por e-mail (cadastro com termos, confirmação, link de uso único, senha antiga recusada); e axe-core (WCAG 2.1 A/AA) em 26 páginas nos temas escuro e claro, sem nenhuma violação.

## Como gerar o build

```bash
npm run build      # build de produção (Turbopack)
npm start          # serve o build em http://localhost:3000
```

Com Docker (Next.js *standalone*, usuário sem privilégios, *healthcheck* em `/api/saude`):

```bash
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
docker compose up --build      # PostgreSQL + migrações e seed + app em http://localhost:3000
```

Variáveis opcionais (SMTP, VAPID, IA…) podem ir num arquivo `.env.docker`.

## Como realizar deploy

O VIVA é um app Next.js padrão com PostgreSQL; qualquer plataforma Node serve.

1. Provisione um PostgreSQL gerenciado (com backups automáticos) e anote a `DATABASE_URL`. Em plataformas serverless, use a URL com *connection pooling* do provedor.
2. Configure as variáveis de ambiente de produção (no mínimo `DATABASE_URL`, `BETTER_AUTH_SECRET` novo e forte, `BETTER_AUTH_URL=https://seu-dominio`). A chave de IA é opcional.
3. No pipeline de deploy:
   ```bash
   npm ci
   npm run db:migrate
   npm run db:seed        # primeira vez e quando o catálogo mudar
   npm run build
   npm start              # ou o comando de start da plataforma
   ```
4. Sirva **apenas via HTTPS** (os cookies de sessão passam a ser `Secure`), atrás de um proxy/CDN.
5. Preencha `VIVA_PRIVACY_CONTACT` e revise a política em `/privacidade` e os termos em `/termos` com o responsável jurídico antes de abrir ao público (os termos são um texto-base, ainda sem revisão jurídica).

Em Vercel: conecte o repositório, defina as variáveis, use um PostgreSQL externo (Neon, Supabase, RDS…) e rode `npm run db:migrate` como etapa de build ou manualmente antes de promover a versão. Com Supabase, use o *pooler* (Supavisor): porta 6543 (modo transação) em `DATABASE_URL` para o app e porta 5432 (modo sessão) para `prisma migrate deploy`, que precisa de *advisory locks*. Para isolar o VIVA de outras tabelas do mesmo banco, use um schema próprio fora da Data API (ex.: `?schema=viva`) com um usuário dono dele e `ALTER ROLE … SET search_path = viva` (as consultas SQL diretas da gamificação usam o `search_path`). Em servidor próprio ou qualquer plataforma de contêineres, use a imagem do `Dockerfile`.

**Lembretes por notificação push:** gere as chaves com `npm run push:chaves`, configure `VAPID_*` e `CRON_SECRET` no servidor e agende uma chamada a `/api/cron/lembretes` a cada 15 minutos. Opções gratuitas: o workflow `.github/workflows/lembretes.yml` (defina os segredos `VIVA_URL` e `CRON_SECRET` no repositório; agendamentos rodam só no branch padrão), um cron do servidor ou o Vercel Cron (confira o limite de frequência do seu plano).

## Integrações externas e requisitos

| Integração | Situação | Requisitos |
|---|---|---|
| **Claude (Anthropic)** — conversa do assistente | Implementada, opcional | `ANTHROPIC_API_KEY` no servidor e consentimento de cada usuário. Usa o modelo de `VIVA_AI_MODEL` (padrão `claude-opus-5-5`), esforço `medium` e *fallback* de recusa no servidor (`fallbacks: "default"`). Envia só a pergunta, as últimas mensagens e, se a pessoa permitir, um contexto mínimo (objetivo, nível/local de treino, cozinha, alergias, intolerâncias, restrições e alimentos que não come). Nunca envia nome, e-mail, idade, peso, medidas ou orçamento. |
| **Notificações push (Web Push)** | Implementado, opcional | Chaves VAPID (`npm run push:chaves`), `CRON_SECRET` e um agendador. Gratuito: usa o serviço de push do próprio navegador. No iPhone, exige o VIVA instalado na tela de início. Testado com um serviço de push local em HTTPS; ainda não testado em aparelhos reais. |
| **Open Food Facts** — código de barras | Implementado, ligado por padrão | API pública e gratuita; só o código de barras é enviado. Dados sob licença ODbL. Formato conferido na especificação OpenAPI oficial; a rede deste ambiente de desenvolvimento bloqueia o domínio, então a chamada real não foi testada. |
| **E-mail transacional (SMTP)** | Implementado, opcional | Qualquer provedor com SMTP — por exemplo Brevo, Resend, Amazon SES ou Gmail com senha de app (confira os limites atuais do plano gratuito de cada um). Configure `EMAIL_FROM` e `SMTP_*`, e um domínio com SPF, DKIM e DMARC para os e-mails não caírem no spam. Testado com um servidor SMTP local; o envio por um provedor real ainda não foi testado. |
| **Open Prices** — preços da comunidade | Implementado, desligado por padrão (`VIVA_OPEN_PRICES=on`) | API pública do Open Food Facts, dados ODbL. Só hortifrúti a granel, por kg, em BRL, do Brasil, sem promoção, até 30 dias; grava loja, cidade, data e link. A cobertura no Brasil depende da comunidade. Mesmo cuidado de teste do Open Food Facts. |
| **Preços de supermercados (API oficial)** | Contrato pronto | Para uma fonte **autorizada** (API oficial/parceria), implemente `PriceProvider` em `src/server/integrations/` e registre em `PRICE_PROVIDERS`. As cotações são validadas (`quoteProblem`) e gravadas com origem "integração externa", loja, data e referência. O VIVA não coleta preços de sites sem autorização. |
| **Tabela TACO** | Embutida no seed | Nenhum requisito em execução; a conversão é reprodutível com `scripts/convert_taco.py`. |

## Funcionalidades ainda não implementadas

- Vídeos ou imagens dos exercícios (há passo a passo em texto e mapa corporal) — exigem conteúdo próprio ou licenciado.
- Preços por API oficial de supermercados — exige parceria; hoje há preços informados pela pessoa e, opcionalmente, da comunidade (Open Prices).
- Leitura do código de barras pela câmera (o código é digitado; a câmera está bloqueada pela `Permissions-Policy`).
- Revisão profissional dos 499 alimentos da TACO ainda sem revisão de alergênicos (a ferramenta existe; falta a revisão por nutricionista).
- Compartilhamento com nutricionista ou personal trainer.
- Uso offline com registro de dados (por privacidade, nada é salvo no aparelho).

## Limitações conhecidas

- Dos 597 alimentos da TACO, 98 foram revisados manualmente para alérgenos; os demais **não são sugeridos** a quem registrou alergia e aparecem com aviso. Rótulos de produtos industrializados variam por marca: a pessoa deve sempre conferir a embalagem.
- A conversão cozido → cru usa a umidade da TACO e é uma estimativa (indicada na lista).
- A estimativa de gasto energético é educativa e não substitui avaliação profissional.
- Integrações externas foram testadas contra servidores locais nos formatos oficiais (a rede deste ambiente bloqueia os domínios): IA (Anthropic), SMTP, Web Push, Open Food Facts e Open Prices ainda precisam de um teste com as contas/serviços reais na sua instalação.
- A CSP permite `style` em atributos (`style-src-attr 'unsafe-inline'`), usado por barras de progresso e gráficos; scripts e blocos `<style>` exigem nonce.
- O limite de frequência usa uma tabela no PostgreSQL — adequado para uma instância/região; em escala horizontal grande, considere um armazenamento dedicado.
- Acessibilidade verificada com checagens automáticas (nomes acessíveis, rótulos, IDs, títulos), navegação por teclado e contraste: todos os tokens de texto têm pelo menos 4,5:1 (WCAG AA) sobre todas as superfícies, nos dois temas. Ainda não houve testes com pessoas usuárias de leitores de tela.
- Interface apenas em português do Brasil, com moeda em reais e unidades métricas.

## Cuidados de segurança e privacidade (LGPD)

- **Autenticação:** senhas com hash (scrypt, via Better Auth), cookies `httpOnly`/`SameSite`, sessões no banco; limites de frequência no login (por IP e por e-mail), cadastro, exclusão de conta e IA.
- **Autorização no servidor:** toda page/action exige sessão e toda consulta é filtrada pelo `userId`; o *proxy* é só uma otimização. O isolamento entre usuários é coberto por testes de integração.
- **Validação:** todas as entradas passam por Zod no servidor; o frontend não é confiável.
- **Segredos:** chaves só em variáveis de ambiente do servidor; nada sensível em `NEXT_PUBLIC_*`; `.env` fora do Git.
- **Cabeçalhos:** Content-Security-Policy com nonce por requisição (sem `eval` em produção, `frame-ancestors 'none'`, `object-src 'none'`), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `poweredByHeader` desativado.
- **Rotas de API:** a do assistente exige mesma origem (CSRF), sessão, consentimento e limite por hora; a de lembretes exige `CRON_SECRET` (comparação em tempo constante).
- **Dependências:** `npm audit` das dependências de produção sem vulnerabilidades conhecidas (verificado nesta versão).
- **Logs:** erros registram apenas tipo/código, sem dados pessoais nem conteúdo de conversas.
- **LGPD:** consentimentos versionados (termos de uso, política, dados de saúde e IA, com revogação), página `/privacidade` com finalidades e direitos, exportação completa em JSON e exclusão da conta (senha + confirmação "EXCLUIR") com remoção em cascata.
- **PWA e push:** o service worker não guarda páginas autenticadas em cache; a notificação leva só o texto do lembrete e abre apenas páginas do próprio VIVA.

## Licenças e fontes dos dados

- **Composição de alimentos:** NEPA/UNICAMP. *Tabela Brasileira de Composição de Alimentos — TACO*. 4ª ed. revisada e ampliada. Campinas: NEPA-UNICAMP, 2011. Dados públicos, usados com citação da fonte. A extração partiu do projeto [raulfdm/taco-api](https://github.com/raulfdm/taco-api) (licença MIT) e é reproduzível com `scripts/convert_taco.py`.
- **Alérgenos:** classificação curada para o VIVA com base nos grupos da RDC ANVISA nº 26/2015 (rotulagem de alergênicos), mais gergelim. É informativa e não substitui o rótulo do produto.
- **Receitas, produtos de referência, exercícios e textos:** elaborados para o VIVA; valores nutricionais das receitas calculados a partir da TACO. Os produtos de referência têm embalagens típicas, **sem preços**.
- **Open Food Facts e Open Prices:** dados abertos sob a Open Database License (ODbL); a origem é exibida junto aos dados importados.
- **Bibliotecas de terceiros com licenças a observar:** `web-push` (MPL-2.0), `nodemailer` (MIT-0), `@axe-core/playwright` (MPL-2.0, só em testes).
- **Fontes tipográficas:** Bricolage Grotesque e Figtree — SIL Open Font License, via Fontsource.
- **Ícones:** Lucide — licença ISC.
- **Código do VIVA:** uso privado (sem licença de código aberto definida).
