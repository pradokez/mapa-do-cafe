// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Revisao } from "@/lib/revisao";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/admin/revisoes-actions", () => ({ aprovarRevisao: vi.fn(), rejeitarRevisao: vi.fn() }));
// `useFormState`/`useFormStatus` vêm do React canary do Next; o `react-dom` do Vitest não os tem.
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  useFormState: (_acao: unknown, inicial: unknown) => [inicial, vi.fn()],
  useFormStatus: () => ({ pending: false }),
}));

import { CartaoRevisoes } from "./cartao-revisoes";
import { FiltroDeStatus, TrocaDeFiltro } from "./filtro-de-status";
import { ListaDeRevisoes } from "./lista-de-revisoes";

afterEach(cleanup);

const AGORA = new Date("2026-10-28T12:00:00Z");
const FONTE = {
  url: "https://exemplo.com/post",
  titulo: "Post do café",
  data_fonte: "2026-09-30",
  trecho: "Agora abrimos às 8h",
  atualidade: "atualizada" as const,
};

function revisao(p: Partial<Revisao>): Revisao {
  return {
    id: "r1",
    tipo: "atualizacao",
    cafe_id: "c1",
    campo: "telefone",
    valor_atual: "(81) 3071-6834",
    valor_proposto: "(81) 99908-4986",
    fontes: [FONTE],
    atualidade: "atualizada",
    status: "pendente",
    criado_em: "2026-10-20T12:00:00Z",
    decidido_em: null,
    cafe: { nome: "Café A", slug: "cafe-a", ativo: true },
    nome_proposto: null,
    ...p,
  };
}

describe("ListaDeRevisoes", () => {
  it("mostra o valor atual e o proposto lado a lado, com a etiqueta e o campo", () => {
    render(<ListaDeRevisoes revisoes={[revisao({})]} agora={AGORA} total={1} />);
    expect(screen.getByRole("heading", { name: "Café A" }).querySelector("a")?.getAttribute("href")).toBe("/admin/cafes/c1");
    expect(screen.getByText("Telefone")).toBeTruthy();
    expect(screen.getByText("Atualizada")).toBeTruthy();
    expect(screen.getByText("(81) 3071-6834")).toBeTruthy();
    expect(screen.getByText("(81) 99908-4986")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver no site" }).getAttribute("href")).toBe("/cafes/cafe-a");
  });

  it("agrupa as revisões do mesmo café sob um só título", () => {
    render(
      <ListaDeRevisoes
        revisoes={[revisao({ id: "r1" }), revisao({ id: "r2", campo: "instagram", valor_atual: null, valor_proposto: "https://instagram.com/a" })]}
        agora={AGORA}
        total={2}
      />,
    );
    expect(screen.getAllByRole("heading", { name: "Café A" })).toHaveLength(1);
    expect(screen.getByText("Sem informação")).toBeTruthy();
  });

  it("as quatro etiquetas de atualidade", () => {
    render(
      <ListaDeRevisoes
        revisoes={[
          revisao({ id: "a", atualidade: "antiga", fontes: [{ ...FONTE, data_fonte: "2024-09-01" }] }),
          revisao({ id: "b", atualidade: "sem_data" }),
          revisao({ id: "c", atualidade: "conflito" }),
        ]}
        agora={AGORA}
        total={3}
      />,
    );
    expect(screen.getByText("Antiga · 2 anos")).toBeTruthy();
    expect(screen.getByText("Sem data")).toBeTruthy();
    expect(screen.getByText("Fontes discordam")).toBeTruthy();
  });

  it("fontes recolhíveis: título em link de nova aba, data e trecho literal", () => {
    render(<ListaDeRevisoes revisoes={[revisao({})]} agora={AGORA} total={1} />);
    const fontes = screen.getByText("1 fonte").closest("details")!;
    const link = within(fontes).getByRole("link", { name: /Post do café/ });
    expect(link.getAttribute("href")).toBe("https://exemplo.com/post");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(within(fontes).getByText("Data na página: 2026-09-30")).toBeTruthy();
    expect(within(fontes).getByText("“Agora abrimos às 8h”")).toBeTruthy();
  });

  it("fonte com URL que não é http vira texto, sem link", () => {
    const fonte = { ...FONTE, url: "javascript:alert(1)" };
    render(<ListaDeRevisoes revisoes={[revisao({ fontes: [fonte] })]} agora={AGORA} total={1} />);
    expect(screen.queryByRole("link", { name: /Post do café/ })).toBeNull();
    expect(screen.getByText("Post do café")).toBeTruthy();
  });

  it("café fora do ar não tem 'Ver no site'; café novo mostra o nome da proposta, sem link", () => {
    render(
      <ListaDeRevisoes
        revisoes={[
          revisao({ id: "f", tipo: "fechamento", campo: null, cafe: { nome: "Café B", slug: "cafe-b", ativo: false } }),
          revisao({ id: "n", tipo: "cafe_novo", cafe_id: null, campo: null, cafe: null, nome_proposto: "Café Novo", valor_proposto: { nome: "Café Novo", bairro: "Pina", cidade: "Recife" } }),
        ]}
        agora={AGORA}
        total={2}
      />,
    );
    expect(screen.getByText("Fora do ar")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ver no site" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Café Novo" }).querySelector("a")).toBeNull();
    expect(screen.getByText("Pina · Recife")).toBeTruthy();
  });

  it("fila vazia e teto", () => {
    const { rerender } = render(<ListaDeRevisoes revisoes={[]} agora={AGORA} total={0} />);
    expect(screen.getByText("Nada por aqui com esse filtro.")).toBeTruthy();
    rerender(<ListaDeRevisoes revisoes={[revisao({})]} agora={AGORA} total={250} />);
    expect(screen.getByText("Mostrando as 1 mais recentes de 250.")).toBeTruthy();
  });

  it("texto do robô sai como texto, nunca como HTML", () => {
    const { container } = render(
      <ListaDeRevisoes revisoes={[revisao({ valor_proposto: "<script>x</script>" })]} agora={AGORA} total={1} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>x</script>")).toBeTruthy();
  });
});

describe("decisões na fila (#182)", () => {
  const botoes = (item: HTMLElement) =>
    within(item)
      .queryAllByRole("button")
      .map((b) => b.textContent);

  it("atualizada: Aprovar num clique e Rejeitar, cada um um form com o id", () => {
    render(<ListaDeRevisoes revisoes={[revisao({})]} agora={AGORA} total={1} />);
    const item = screen.getByText("Telefone").closest("li")!;

    expect(botoes(item)).toEqual(["Aprovar", "Rejeitar"]);
    for (const form of Array.from(item.querySelectorAll("form"))) {
      expect(form.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe("r1");
      expect(form.querySelector('input[name="confirmacao"]')).toBeNull();
    }
  });

  it("antiga: Aprovar abre a confirmação com a idade da fonte, que envia confirmacao=1", () => {
    const fontes = [{ ...FONTE, data_fonte: "2024-03-10", atualidade: "antiga" as const }];
    render(<ListaDeRevisoes revisoes={[revisao({ atualidade: "antiga", fontes })]} agora={AGORA} total={1} />);
    const confirmacao = screen.getByText("Aprovar…").closest("details")!;

    expect(confirmacao.textContent).toContain("A fonte mais recente tem 2 anos. Aprovar mesmo assim?");
    const enviar = within(confirmacao).getByRole("button", { name: "Aprovar mesmo assim", hidden: true });
    expect(enviar.closest("form")?.querySelector<HTMLInputElement>('input[name="confirmacao"]')?.value).toBe("1");
  });

  it("fechado temporariamente: Ver café e Arquivar, sem Aprovar", () => {
    render(<ListaDeRevisoes revisoes={[revisao({ campo: null })]} agora={AGORA} total={1} />);
    const item = screen.getByText(/Indício sem campo/).closest("li")!;

    expect(botoes(item)).toEqual(["Arquivar"]);
    expect(within(item).getByRole("link", { name: "Ver café" }).getAttribute("href")).toBe("/admin/cafes/c1");
  });

  it("café novo se aprova direto (abre o cadastro, #187), mesmo sem data; revisão decidida não tem botão", () => {
    render(
      <ListaDeRevisoes
        revisoes={[
          revisao({
            id: "n",
            tipo: "cafe_novo",
            cafe_id: null,
            campo: null,
            cafe: null,
            nome_proposto: "Novo",
            atualidade: "sem_data",
          }),
          revisao({ id: "d", cafe_id: "c2", status: "aprovada", cafe: { nome: "Café B", slug: "b", ativo: true } }),
        ]}
        agora={AGORA}
        total={2}
      />,
    );

    expect(botoes(document.querySelector<HTMLElement>('[data-revisao="n"]')!)).toEqual(["Aprovar", "Rejeitar"]);
    expect(botoes(document.querySelector<HTMLElement>('[data-revisao="d"]')!)).toEqual([]);
  });
});

describe("FiltroDeStatus das revisões", () => {
  it("chips por status, com o padrão em pendentes e o form apontando para a fila", () => {
    const { container } = render(
      <TrocaDeFiltro lista="revisoes">
        <FiltroDeStatus ativos={["pendente"]} contagem={{ pendente: 2, aprovada: 5, rejeitada: 0, obsoleta: 1 }} />
      </TrocaDeFiltro>,
    );
    expect(container.querySelector("form")?.getAttribute("action")).toBe("/admin/revisoes");
    expect(screen.getByRole("button", { name: /Pendentes/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Aprovadas/ }).getAttribute("value")).toBe("pendente,aprovada");
  });
});

describe("CartaoRevisoes", () => {
  const rodada = { id: "x", inicio: "2026-10-28T02:30:00Z", fim: null, cafes_verificados: 0, revisoes_criadas: 0, erro: null };

  it("com pendentes: contagem e última rodada", () => {
    render(<CartaoRevisoes pendentes={3} rodada={rodada} />);
    expect(screen.getByText("3 revisões pendentes")).toBeTruthy();
    expect(screen.getByText(/Última rodada: 27\/10, 23:30/)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/admin/revisoes");
  });

  it("sem pendentes o cartão continua, com 'Ver todas'", () => {
    render(<CartaoRevisoes pendentes={0} rodada={rodada} />);
    expect(screen.getByText(/Nenhuma revisão pendente/)).toBeTruthy();
    expect(screen.getByText("Ver todas")).toBeTruthy();
  });

  it("sem rodada: 'O robô ainda não rodou'", () => {
    render(<CartaoRevisoes pendentes={0} rodada={null} />);
    expect(screen.getByText(/O robô ainda não rodou/)).toBeTruthy();
  });
});
