import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Privacidade, dados e aviso de saúde" };

const DATA_TABLE: { what: string; why: string; basis: string }[] = [
  { what: "Nome ou apelido e e-mail", why: "Criar e proteger sua conta; identificar você no app.", basis: "Execução do serviço (art. 7º, V)" },
  { what: "Senha", why: "Autenticação. Guardada apenas como hash (scrypt), nunca em texto.", basis: "Execução do serviço" },
  {
    what: "Idade, altura, peso e medidas (opcionais)",
    why: "Mostrar sua evolução e, se você pedir, estimativas educativas.",
    basis: "Consentimento específico para dados de saúde (art. 11, I)",
  },
  {
    what: "Objetivo, rotina, treinos, cargas e hábitos",
    why: "Montar rotinas, registrar sessões e acompanhar progresso.",
    basis: "Consentimento específico (art. 11, I)",
  },
  {
    what: "Preferências, alergias, intolerâncias e restrições",
    why: "Evitar sugestões incompatíveis — alergias são tratadas como restrições críticas.",
    basis: "Consentimento específico (art. 11, I)",
  },
  { what: "Orçamento, preços e listas de compras", why: "Calcular custos e o saldo do seu orçamento.", basis: "Execução do serviço" },
  {
    what: "Mensagens ao assistente",
    why: "Responder suas dúvidas. Enviadas a um provedor de IA somente se você ativar essa opção.",
    basis: "Consentimento (art. 7º, I e art. 11, I)",
  },
  {
    what: "Endereço IP e navegador da sessão",
    why: "Segurança da conta e limitação de tentativas de acesso.",
    basis: "Legítimo interesse / segurança (art. 7º, IX)",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link href="/" aria-label="Página inicial do VIVA">
        <Logo />
      </Link>
      <main id="conteudo" className="mt-10 space-y-10 text-ink-2 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-ink">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-text">Versão 2026-10</p>
          <h1 className="mt-2 text-4xl font-extrabold text-ink">Privacidade, dados e aviso de saúde</h1>
          <p className="mt-3">
            Este documento explica, em linguagem direta, quais dados o VIVA trata, por quê, por quanto tempo e como você
            exerce seus direitos segundo a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
          </p>
        </header>

        <section aria-labelledby="dados">
          <h2 id="dados">O que guardamos e por quê</h2>
          <div className="relative overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-surface-2 text-ink">
                <tr>
                  <th className="px-4 py-3 font-semibold">Dado</th>
                  <th className="px-4 py-3 font-semibold">Finalidade</th>
                  <th className="px-4 py-3 font-semibold">Base legal</th>
                </tr>
              </thead>
              <tbody>
                {DATA_TABLE.map((row) => (
                  <tr key={row.what} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{row.what}</td>
                    <td className="px-4 py-3">{row.why}</td>
                    <td className="px-4 py-3">{row.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">
            Coletamos o mínimo necessário: quase tudo no perfil é opcional e pode ser preenchido depois. Não vendemos dados e
            não usamos seus dados para publicidade.
          </p>
        </section>

        <section aria-labelledby="direitos">
          <h2 id="direitos">Seus direitos</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-ink">Acesso e portabilidade:</strong> em Perfil → Privacidade, baixe todos os seus dados em
              formato JSON.
            </li>
            <li>
              <strong className="text-ink">Correção:</strong> todas as informações do perfil, registros e medidas podem ser
              editadas ou apagadas a qualquer momento.
            </li>
            <li>
              <strong className="text-ink">Exclusão:</strong> em Perfil → Privacidade, exclua a conta. Todos os dados vinculados são
              apagados imediatamente do banco de dados de produção.
            </li>
            <li>
              <strong className="text-ink">Revogação de consentimento:</strong> o uso de IA no assistente pode ser desativado a
              qualquer momento. Para revogar o consentimento de dados de saúde, exclua a conta.
            </li>
          </ul>
        </section>

        <section aria-labelledby="seguranca">
          <h2 id="seguranca">Segurança e retenção</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Senhas com hash; sessões em cookies httpOnly; acesso a cada registro verificado no servidor.</li>
            <li>Tentativas de login e ações sensíveis têm limite de frequência.</li>
            <li>Registros de erro não incluem dados pessoais.</li>
            <li>Sessões expiram após 30 dias sem uso. Os dados ficam guardados enquanto a conta existir.</li>
            <li>
              Assistente com IA: quando ativado, a pergunta é enviada pelo servidor à Anthropic (Claude). Se você permitir, vão junto
              apenas objetivo, nível e local de treino, preferência de cozinha, alergias, intolerâncias, restrições e alimentos que você não
              come — nunca nome, e-mail, idade, peso, medidas ou orçamento. A tela do assistente mostra exatamente o que será enviado, e a
              conversa pode ser apagada a qualquer momento.
            </li>
          </ul>
        </section>

        <section aria-labelledby="fontes">
          <h2 id="fontes">Fontes de dados</h2>
          <p>
            Informações nutricionais: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e ampliada,
            NEPA/UNICAMP, 2011 — reprodução permitida com citação da fonte. Preços são informados por você ou importados de
            arquivos que você envia; o VIVA não consulta preços de lojas automaticamente.
          </p>
        </section>

        <section aria-labelledby="saude-title" id="saude" className="rounded-3xl border border-amber/30 bg-amber-soft p-6">
          <h2 id="saude-title">Aviso de saúde</h2>
          <ul className="list-disc space-y-2 pl-5 text-ink">
            <li>O VIVA é uma ferramenta de organização e acompanhamento. Não é um serviço médico ou nutricional.</li>
            <li>
              Não substitui nutricionistas, médicos ou profissionais de educação física. Condições clínicas, gestação, diabetes,
              transtornos alimentares e outras necessidades especiais exigem acompanhamento profissional.
            </li>
            <li>Estimativas exibidas no app são educativas e aproximadas.</li>
            <li>
              Interrompa o exercício e procure atendimento em caso de dor no peito, tontura, falta de ar fora do normal ou dor
              aguda.
            </li>
          </ul>
        </section>

        <p className="text-sm">
          Contato do encarregado de dados (DPO):{" "}
          {process.env.VIVA_PRIVACY_CONTACT ? (
            <strong className="text-ink">{process.env.VIVA_PRIVACY_CONTACT}</strong>
          ) : (
            <span>a ser definido por quem publicar esta instância do VIVA (variável VIVA_PRIVACY_CONTACT).</span>
          )}
        </p>
      </main>
    </div>
  );
}
