import type { Metadata } from "next";

import { DadosCafeForm } from "@/components/admin/dados-cafe-form";
import { Fontes } from "@/components/admin/lista-de-revisoes";
import { VoltarAoPainel } from "@/components/admin/voltar-ao-painel";
import { cadastrarCafe, coordenadasDoLink } from "@/lib/admin/cafe-actions";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getRevisaoById } from "@/lib/cafe-repository";
import { cadastroDaRevisao, type Revisao } from "@/lib/revisao";
import type { Sinal } from "@/lib/revisao-proposta";
import { isHttpUrl } from "@/lib/url";

export const metadata: Metadata = { title: "Novo café" };

type Props = { searchParams: { revisao?: string | string[] } };

// O Next renderiza layout e página em paralelo: a página confere o admin por conta própria.
export default async function NovoCafe({ searchParams }: Props) {
  await requireAdmin();

  // Aberto pelo "Aprovar" de um café novo (#187). Revisão inexistente, malformada,
  // já decidida ou de outro tipo não quebra: o cadastro abre em branco, com um aviso.
  const param = searchParams.revisao;
  const pedida = typeof param === "string" ? await getRevisaoById(param) : null;
  const revisao = pedida?.tipo === "cafe_novo" && pedida.status === "pendente" ? pedida : null;
  const proposta = revisao ? cadastroDaRevisao(revisao.valor_proposto) : null;

  return (
    <>
      <VoltarAoPainel />

      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-[1.1] text-espresso">Novo café</h1>
        <p className="mt-1.5 text-[14.5px] text-ink-2">
          O café nasce fora do ar. Depois de cadastrar, suba as fotos e coloque no ar na seção Status.
        </p>
      </header>

      {param !== undefined && !revisao && (
        <p role="status" className="mb-4 rounded-lg border border-aviso-line bg-aviso-bg px-4 py-3 text-[14px] text-aviso-fg">
          <span className="font-semibold">Esta revisão não está mais pendente.</span> O cadastro abre em branco.
        </p>
      )}

      {revisao && proposta && <DaRevisao revisao={revisao} sinais={proposta.sinais} />}

      <section aria-label="Dados do café" className="rounded-xl border border-card-line bg-white px-5 py-4">
        <DadosCafeForm
          cadastrar={cadastrarCafe}
          revisao={revisao && proposta ? { id: revisao.id, campos: proposta.campos } : undefined}
          buscarCoordenadas={coordenadasDoLink}
        />
      </section>
    </>
  );
}

/** O que sustenta a proposta, à vista enquanto a administradora completa o cadastro. Textos da web: texto puro. */
function DaRevisao({ revisao, sinais }: { revisao: Revisao; sinais: Sinal[] }) {
  return (
    <section
      aria-labelledby="da-revisao"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-card-line bg-white px-5 py-4"
    >
      <div>
        <h2 id="da-revisao" className="text-[15px] font-semibold text-espresso">
          Proposta da curadoria
        </h2>
        <p className="mt-1 text-[13.5px] text-ink-2">
          Confira o que veio preenchido e complete o endereço no site, as coordenadas e o que faltar. Cadastrar marca a
          revisão como aprovada.
        </p>
      </div>
      <div>
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Sinais de café especial</h3>
        {sinais.length === 0 ? (
          <p className="mt-1 text-[13.5px] text-ink-3">Nenhum sinal na proposta.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2.5 text-[13.5px]">
            {sinais.map((sinal, i) => (
              <li key={i} className="border-l-2 border-line-strong pl-3">
                <p className="font-medium text-espresso [overflow-wrap:anywhere]">
                  {isHttpUrl(sinal.url) ? (
                    <a
                      href={sinal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-terracotta"
                    >
                      {sinal.sinal}
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  ) : (
                    sinal.sinal
                  )}
                </p>
                <blockquote className="mt-0.5 whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">“{sinal.trecho}”</blockquote>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Fontes fontes={revisao.fontes} />
    </section>
  );
}
