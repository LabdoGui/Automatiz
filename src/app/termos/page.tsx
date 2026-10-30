import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CONSENT_VERSION } from "@/server/services/account";

export const metadata: Metadata = { title: "Termos de uso" };

/*
 * Texto-base preparado para revisão jurídica antes da publicação (veja o README).
 * Ao alterar o conteúdo de forma relevante, atualize CONSENT_VERSION para que
 * novos aceites fiquem registrados com a versão correta.
 */
export default function TermsPage() {
  const contact = process.env.VIVA_PRIVACY_CONTACT;
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link href="/" aria-label="Página inicial do VIVA">
        <Logo />
      </Link>
      <main
        id="conteudo"
        className="mt-10 space-y-8 text-ink-2 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-ink [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5"
      >
        <header>
          <p className="text-xs font-bold tracking-[0.16em] text-lime-text uppercase">Versão {CONSENT_VERSION}</p>
          <h1 className="mt-2 text-4xl font-extrabold text-ink">Termos de uso</h1>
          <p className="mt-3">
            Estes termos explicam as regras para usar o VIVA. Ao criar uma conta, você declara que leu e concorda com eles e com a{" "}
            <Link href="/privacidade" className="font-semibold text-lime-text underline">
              política de privacidade
            </Link>
            .
          </p>
        </header>

        <section aria-labelledby="t-servico">
          <h2 id="t-servico">1. O que é o VIVA</h2>
          <p>
            O VIVA é uma ferramenta de organização para planejar refeições, compras, treinos e hábitos. As informações nutricionais vêm da Tabela
            Brasileira de Composição de Alimentos (TACO) e de dados que você informa; os preços são sempre informados por você ou por fontes
            identificadas na tela.
          </p>
        </section>

        <section aria-labelledby="t-saude">
          <h2 id="t-saude">2. Não é um serviço de saúde</h2>
          <ul>
            <li>O VIVA não faz diagnósticos nem prescreve dietas, suplementos, medicamentos ou treinos individualizados.</li>
            <li>
              Estimativas, sugestões e respostas do assistente são educativas e podem conter erros. Não substituem nutricionistas, médicos ou
              profissionais de educação física.
            </li>
            <li>
              Alergias e intolerâncias exigem atenção: confira sempre o rótulo dos produtos, porque a composição e o risco de traços variam por
              marca.
            </li>
            <li>Interrompa qualquer exercício e procure atendimento em caso de dor no peito, tontura, falta de ar fora do normal ou dor aguda.</li>
          </ul>
        </section>

        <section aria-labelledby="t-conta">
          <h2 id="t-conta">3. Sua conta</h2>
          <ul>
            <li>O VIVA é destinado a pessoas com 18 anos ou mais.</li>
            <li>Você é responsável por manter sua senha em sigilo e pelas informações que registra.</li>
            <li>Você pode exportar seus dados ou excluir a conta a qualquer momento, em Perfil → Privacidade e dados.</li>
          </ul>
        </section>

        <section aria-labelledby="t-uso">
          <h2 id="t-uso">4. Uso permitido</h2>
          <p>Não é permitido:</p>
          <ul>
            <li>acessar contas ou dados de outras pessoas, ou tentar burlar os mecanismos de segurança;</li>
            <li>sobrecarregar o serviço com acessos automatizados ou explorar falhas;</li>
            <li>usar o assistente ou outros recursos para fins ilícitos ou que coloquem a saúde de alguém em risco.</li>
          </ul>
          <p className="mt-3">O descumprimento pode levar à suspensão do acesso, com aviso sempre que possível.</p>
        </section>

        <section aria-labelledby="t-ia">
          <h2 id="t-ia">5. Assistente com IA (opcional)</h2>
          <p>
            A conversa com IA só funciona se você ativar. As respostas são geradas automaticamente por um provedor externo, ficam identificadas como
            IA e podem conter erros. Use-as como apoio, nunca como orientação de saúde. Você pode desativar o recurso e apagar a conversa quando
            quiser.
          </p>
        </section>

        <section aria-labelledby="t-gamificacao">
          <h2 id="t-gamificacao">6. Pontos, níveis e conquistas</h2>
          <p>XP, níveis, conquistas e desafios servem apenas para acompanhar sua constância. Não têm valor monetário e não podem ser trocados.</p>
        </section>

        <section aria-labelledby="t-disponibilidade">
          <h2 id="t-disponibilidade">7. Disponibilidade e alterações</h2>
          <ul>
            <li>
              Trabalhamos para manter o VIVA disponível e correto, mas o serviço pode passar por manutenções, falhas ou mudanças de funcionalidades.
            </li>
            <li>
              Mudanças relevantes nestes termos serão comunicadas no app, com nova versão. Se você não concordar, pode excluir sua conta a qualquer
              momento.
            </li>
          </ul>
        </section>

        <section aria-labelledby="t-responsabilidade">
          <h2 id="t-responsabilidade">8. Responsabilidade</h2>
          <p>
            Nada nestes termos afasta os direitos garantidos pelo Código de Defesa do Consumidor (Lei nº 8.078/1990) e pela Lei Geral de Proteção
            de Dados (Lei nº 13.709/2018). Decisões sobre alimentação, treino e saúde devem considerar a orientação de profissionais habilitados.
          </p>
        </section>

        <section aria-labelledby="t-fontes">
          <h2 id="t-fontes">9. Conteúdo e fontes</h2>
          <p>
            Os textos, receitas, exercícios e a identidade visual do VIVA são protegidos. Dados nutricionais: NEPA/UNICAMP — Tabela Brasileira de
            Composição de Alimentos (TACO), 4ª edição, 2011.
          </p>
        </section>

        <section aria-labelledby="t-lei">
          <h2 id="t-lei">10. Lei aplicável e contato</h2>
          <p>
            Estes termos seguem as leis brasileiras. Eventuais conflitos podem ser levados ao foro do seu domicílio.{" "}
            {contact ? (
              <>
                Contato: <strong className="text-ink">{contact}</strong>.
              </>
            ) : (
              <>O contato oficial é definido por quem publica esta instância do VIVA.</>
            )}
          </p>
        </section>
      </main>
    </div>
  );
}
