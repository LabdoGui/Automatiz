# VIVA — Seu plano, seu ritmo.

Aplicativo web (PWA) em português do Brasil para **planejar a alimentação da semana, treinar com segurança, comprar dentro do orçamento e manter hábitos** — com dados nutricionais reais (Tabela TACO), preços informados pela própria pessoa e uma gamificação que celebra constância, nunca restrição.

> Status: versão funcional de desenvolvimento, verificada com typecheck, lint, testes unitários, de integração e ponta a ponta (veja [Como rodar testes](#como-rodar-testes)). Ainda **não** passou por um deploy público nem por auditoria externa de segurança/acessibilidade — veja [Limitações conhecidas](#limitações-conhecidas).

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
- Cadastro e login por e-mail/senha, sessão segura, saída da conta, consentimentos versionados (política de privacidade e dados de saúde).
- Onboarding progressivo em 9 etapas (perfil, objetivo, rotina de treino, refeições e cozinha, gostos, alergias × preferências claramente separadas, orçamento por dia/semana/mês, meta do(a) nutricionista com período diário ou semanal, despensa), resumo e confirmação. Tudo editável depois em **Perfil**.
- Estimativa educativa de gasto energético (Mifflin-St Jeor, faixa ±10%, só no navegador e só para maiores de 18 anos) — nunca vira meta automaticamente.

**Alimentação**
- Base nutricional TACO (597 alimentos; 98 revisados com alérgenos, família e grupo de substituição), com estado (cru/cozido/pronto), fonte e campos ausentes sinalizados — valores nunca são estimados.
- Alimentos personalizados criados pela pessoa.
- Planejador semanal (segunda a domingo): geração automática com versão anterior preservada, refeições com CRUD completo, ajuste de quantidades, substituição por equivalentes (mesmo nutriente principal, cru × cozido considerado), duplicação, troca por receita compatível, conclusão, refeição flexível sem linguagem de culpa, totais diários/semanais e avisos de dados incompletos.
- Registro de refeições fora do plano, histórico e despensa.
- 42 receitas com valores calculados a partir da TACO.

**Compras e orçamento**
- Lista consolidada a partir do plano, com conversão cozido→cru, embalagens (unidade, g, ml com densidade, granel em passos de 50 g), despensa descontada e sobras previstas.
- Custo consumido × custo da compra × valor pago; orçamento restante; status e origem de cada preço; marcar como comprado/pago; itens manuais; finalizar lista levando sobras à despensa.
- Cadastro de preços manual, importação por CSV (modelo em `/modelo-precos.csv`) e histórico; sugestões de economia por equivalentes mais baratos que respeitam restrições.

**Treino**
- Catálogo de 39 exercícios por grupo muscular, com passo a passo, erros comuns, cuidados e mapa corporal (sem vídeos falsos).
- Rotina sugerida a partir do perfil (A/B/C), editor de rotinas e treinos.
- Sessão com registro de séries, descanso com cronômetro, pausa/retomada, persistência ao recarregar, alertas de segurança, histórico, comparação com a sessão anterior e evolução por exercício. A progressão é apenas sugerida.

**Progresso e hábitos**
- Filtros de 7/30/90 dias ou período personalizado; consistência alimentar (calendário), treinos por semana, evolução de cargas, peso e medidas opcionais (com edição/exclusão), água por dia, gastos por lista e hábitos personalizados. O peso nunca é o único indicador.

**Gamificação**
- XP idempotente, níveis, mascote que cresce com o nível (nunca com peso), 13 conquistas e 6 desafios semanais opcionais e pausáveis, histórico de XP com a origem de cada ponto, celebrações desligáveis e lembretes dentro do app (opcionais).

**Assistente**
- Ferramentas do VIVA (sem IA): trocar alimento, economizar na semana, refeição mais rápida, como fazer um exercício e o que falta comprar.
- Conversa com IA opcional (Claude, da Anthropic), apenas no servidor, com consentimento explícito, contexto mínimo visível antes do envio, respostas identificadas como IA e histórico apagável. Sem chave configurada, a conversa simplesmente não é oferecida — nada é simulado.

**Plataforma**
- Tema escuro (padrão), claro ou do sistema; redução de movimento; layout mobile-first com navegação inferior no celular e lateral no desktop.
- PWA instalável com ícones e página offline (dados não ficam em cache no aparelho, por privacidade).
- Exportação de todos os dados (JSON) e exclusão da conta.

## Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Turbopack) e React 19 |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS 4 (tokens CSS em `globals.css`), fontes Bricolage Grotesque e Figtree (Fontsource), ícones Lucide |
| Banco | PostgreSQL + Prisma 7 (gerador `prisma-client`, adaptador `@prisma/adapter-pg`) |
| Autenticação | Better Auth (e-mail/senha, sessões em banco, rate limit em banco) |
| Validação | Zod 4 (mensagens em pt-BR) |
| IA (opcional) | SDK oficial `@anthropic-ai/sdk` |
| Testes | Vitest (unidade e integração) e Playwright (ponta a ponta) |

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
- **`src/app`** — páginas (Server Components) e rotas de API mínimas (autenticação, busca de alimentos, exportação de dados).
- **`src/components`** — componentes de interface. `ActionForm` liga formulários às actions com erros acessíveis, toasts e celebrações.
- **`src/proxy.ts`** — verificação otimista de sessão (o antigo *middleware*); a autorização real acontece no servidor, em cada página e action.

Decisões técnicas relevantes:
- `cacheComponents` está **desativado**: quase todas as páginas são por usuário e mudam a cada ação, então a renderização dinâmica clássica é mais simples e previsível.
- Dinheiro em **centavos inteiros**; datas de calendário como `AAAA-MM-DD` (`@db.Date`); horários no fuso da pessoa (padrão `America/Sao_Paulo`); semanas começam na segunda.
- Alimentos cozidos são convertidos para o equivalente cru na lista de compras pelo balanço de matéria seca (umidade TACO).
- Actions que fazem a página atual sumir (finalizar treino, apagar conversa) navegam em vez de revalidar, para não perder o feedback.

## Estrutura de pastas

```
├── prisma/
│   ├── schema.prisma          # modelo de dados
│   ├── migrations/            # migrações SQL versionadas
│   └── seed/                  # catálogo (TACO, receitas, produtos, exercícios, conquistas) e demo
├── public/                    # ícones do PWA, service worker, modelo de CSV
├── scripts/convert_taco.py    # conversão reprodutível da TACO para JSON
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
│   ├── e2e/                   # 12 fluxos principais no navegador
│   └── support/               # setup, fábricas e servidor simulado da API de IA
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
| `VIVA_PRIVACY_CONTACT` | não | Contato do encarregado de dados exibido em `/privacidade`. |
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
npm run test:e2e            # gera o build, sobe em :3100 com viva_test e roda os 12 fluxos no Chromium
npm run test:all            # tudo acima
```

Cobertura atual:
- **Unitários (116):** nutrientes por porção, somas diárias/semanais, metas semanais ÷ 7, conversão cru/cozido, embalagens e granel, custo consumido × compra, consolidação, orçamento, motor de restrições, substituições, gerador do plano, XP/níveis/conquistas/desafios, treino, lembretes, contexto mínimo da IA, validação de cotações e de entradas.
- **Integração (21):** isolamento de dados entre usuários (plano, refeições, listas, medidas, hábitos, preços, exportação, exclusão em cascata), plano respeitando alergias, troca com alérgeno exigindo confirmação, lista consolidada → compra → despensa, treino registrado e recuperado, XP idempotente e conquistas persistentes, metas implausíveis recusadas, importação CSV, cotações de integração e falhas da IA (sem chave, recusa, 401, 429, 500, provedor fora do ar) usando um servidor local que imita a API — sem custo.
- **E2E (12 fluxos):** criar conta e entrar; completar o onboarding; criar um planejamento semanal; editar uma refeição; substituir um ingrediente; gerar a lista de compras; marcar produtos como comprados; registrar um treino; desbloquear uma conquista; consultar o histórico; recarregar e recuperar os dados; sair e entrar novamente.

## Como gerar o build

```bash
npm run build      # build de produção (Turbopack)
npm start          # serve o build em http://localhost:3000
```

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
5. Preencha `VIVA_PRIVACY_CONTACT` e revise a política em `/privacidade` com o responsável jurídico antes de abrir ao público.

Em Vercel: conecte o repositório, defina as variáveis, use um PostgreSQL externo (Neon, Supabase, RDS…) e rode `npm run db:migrate` como etapa de build ou manualmente antes de promover a versão.

## Integrações externas e requisitos

| Integração | Situação | Requisitos |
|---|---|---|
| **Claude (Anthropic)** — conversa do assistente | Implementada, opcional | `ANTHROPIC_API_KEY` no servidor e consentimento de cada usuário. Usa o modelo de `VIVA_AI_MODEL` (padrão `claude-opus-5-5`), esforço `medium` e *fallback* de recusa no servidor (`fallbacks: "default"`). Envia só a pergunta, as últimas mensagens e, se a pessoa permitir, um contexto mínimo (objetivo, nível/local de treino, cozinha, alergias, intolerâncias, restrições e alimentos que não come). Nunca envia nome, e-mail, idade, peso, medidas ou orçamento. |
| **Preços de supermercados** | Contrato pronto, **nenhum provedor configurado** | Implemente `PriceProvider` em `src/server/integrations/price-providers.ts` com uma fonte **autorizada** (API oficial/parceria). As cotações são validadas (`quoteProblem`) e gravadas com origem "Confirmado pela integração", loja, data e referência. O VIVA não coleta preços de sites sem autorização. |
| **Tabela TACO** | Embutida no seed | Nenhum requisito em execução; a conversão é reprodutível com `scripts/convert_taco.py`. |

## Funcionalidades ainda não implementadas

- Recuperação de senha por e-mail e verificação de e-mail (exigem um provedor de e-mail/SMTP).
- Notificações push (os lembretes existem apenas dentro do app).
- Vídeos ou imagens dos exercícios (há passo a passo em texto e mapa corporal).
- Integração automática com preços de mercados (há apenas o contrato).
- Respostas da IA exibidas aos poucos (*streaming*); a resposta aparece completa.
- Leitura de código de barras/rótulos e alimentos de marcas além da TACO (é possível cadastrar alimentos personalizados).
- Compartilhamento com nutricionista ou personal trainer.
- Uso offline com registro de dados (por privacidade, nada é salvo no aparelho).

## Limitações conhecidas

- Dos 597 alimentos da TACO, 98 foram revisados manualmente para alérgenos; os demais **não são sugeridos** a quem registrou alergia e aparecem com aviso. Rótulos de produtos industrializados variam por marca: a pessoa deve sempre conferir a embalagem.
- A conversão cozido → cru usa a umidade da TACO e é uma estimativa (indicada na lista).
- A estimativa de gasto energético é educativa e não substitui avaliação profissional.
- A conversa com IA foi testada contra um servidor local que imita a API; não houve chamadas à API real neste ambiente de desenvolvimento.
- O limite de frequência usa uma tabela no PostgreSQL — adequado para uma instância/região; em escala horizontal grande, considere um armazenamento dedicado.
- Acessibilidade verificada com checagens automáticas (nomes acessíveis, rótulos, IDs, títulos), navegação por teclado e contraste: todos os tokens de texto têm pelo menos 4,5:1 (WCAG AA) sobre todas as superfícies, nos dois temas. Ainda não houve testes com pessoas usuárias de leitores de tela.
- Interface apenas em português do Brasil, com moeda em reais e unidades métricas.

## Cuidados de segurança e privacidade (LGPD)

- **Autenticação:** senhas com hash (scrypt, via Better Auth), cookies `httpOnly`/`SameSite`, sessões no banco; limites de frequência no login (por IP e por e-mail), cadastro, exclusão de conta e IA.
- **Autorização no servidor:** toda page/action exige sessão e toda consulta é filtrada pelo `userId`; o *proxy* é só uma otimização. O isolamento entre usuários é coberto por testes de integração.
- **Validação:** todas as entradas passam por Zod no servidor; o frontend não é confiável.
- **Segredos:** chaves só em variáveis de ambiente do servidor; nada sensível em `NEXT_PUBLIC_*`; `.env` fora do Git.
- **Cabeçalhos:** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `poweredByHeader` desativado.
- **Logs:** erros registram apenas tipo/código, sem dados pessoais nem conteúdo de conversas.
- **LGPD:** consentimentos versionados (política, dados de saúde e IA, com revogação), página `/privacidade` com finalidades e direitos, exportação completa em JSON e exclusão da conta (senha + confirmação "EXCLUIR") com remoção em cascata.
- **PWA:** o service worker não guarda páginas autenticadas em cache.

## Licenças e fontes dos dados

- **Composição de alimentos:** NEPA/UNICAMP. *Tabela Brasileira de Composição de Alimentos — TACO*. 4ª ed. revisada e ampliada. Campinas: NEPA-UNICAMP, 2011. Dados públicos, usados com citação da fonte. A extração partiu do projeto [raulfdm/taco-api](https://github.com/raulfdm/taco-api) (licença MIT) e é reproduzível com `scripts/convert_taco.py`.
- **Alérgenos:** classificação curada para o VIVA com base nos grupos da RDC ANVISA nº 26/2015 (rotulagem de alergênicos), mais gergelim. É informativa e não substitui o rótulo do produto.
- **Receitas, produtos de referência, exercícios e textos:** elaborados para o VIVA; valores nutricionais das receitas calculados a partir da TACO. Os produtos de referência têm embalagens típicas, **sem preços**.
- **Fontes tipográficas:** Bricolage Grotesque e Figtree — SIL Open Font License, via Fontsource.
- **Ícones:** Lucide — licença ISC.
- **Código do VIVA:** uso privado (sem licença de código aberto definida).
