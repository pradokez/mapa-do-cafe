// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Sugestao } from "@/lib/sugestao";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/admin/sugestoes-actions", () => ({ mudarStatusSugestao: vi.fn() }));
// `useFormState`/`useFormStatus` vêm do React canary do Next; o `react-dom` do Vitest não os tem.
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  useFormState: (_acao: unknown, inicial: unknown) => [inicial, vi.fn()],
  useFormStatus: () => ({ pending: false }),
}));

import { FiltroDeStatus, TrocaDeFiltro } from "./filtro-de-status";
import { ListaDeSugestoes } from "./lista-de-sugestoes";

const AGORA = "2026-10-04T18:00:00Z";

function sugestao(campos: Partial<Sugestao>): Sugestao {
  return {
    id: "6934bcef-f5ec-49f8-b8e2-da0e8b31c280",
    tipo: "sugestao",
    mensagem: "Um filtro de aberto agora.",
    origem: "/",
    status: "nova",
    criado_em: "2026-10-04T17:32:00Z",
    ...campos,
  };
}

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("ListaDeSugestoes", () => {
  it("mensagem com HTML aparece como texto, sem virar elemento", () => {
    const mensagem = '<script>alert(1)</script><img src=x onerror="alert(2)"> https://exemplo.com';
    const { container } = render(<ListaDeSugestoes sugestoes={[sugestao({ mensagem })]} agora={AGORA} total={1} />);

    expect(screen.getByText(mensagem)).toBeTruthy();
    expect(container.querySelector("li script, li img")).toBeNull();
    // Sem autolink: o único link do item é o da origem.
    expect(within(container.querySelector("li")!).getAllByRole("link")).toHaveLength(1);
  });

  it("origem vira link interno em nova aba; sem origem, 'origem desconhecida'", () => {
    render(
      <ListaDeSugestoes
        sugestoes={[
          sugestao({ id: "00000000-0000-4000-8000-000000000001", origem: "/cafes/castelinho" }),
          sugestao({ id: "00000000-0000-4000-8000-000000000002", origem: null }),
        ]}
        agora={AGORA}
        total={2}
      />,
    );

    const link = screen.getByRole("link", { name: /\/cafes\/castelinho/ });
    expect(link.getAttribute("href")).toBe("/cafes/castelinho");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("origem desconhecida")).toBeTruthy();
  });

  it("origem fora do formato nunca vira link", () => {
    render(<ListaDeSugestoes sugestoes={[sugestao({ origem: "javascript:alert(1)" })]} agora={AGORA} total={1} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("origem desconhecida")).toBeTruthy();
  });

  it("cada status tem as suas ações", () => {
    render(
      <ListaDeSugestoes
        sugestoes={[
          sugestao({ id: "00000000-0000-4000-8000-000000000001", status: "nova" }),
          sugestao({ id: "00000000-0000-4000-8000-000000000002", status: "lida" }),
          sugestao({ id: "00000000-0000-4000-8000-000000000003", status: "arquivada" }),
        ]}
        agora={AGORA}
        total={3}
      />,
    );

    const botoes = screen.getAllByRole("listitem").map((item) =>
      within(item)
        .getAllByRole("button")
        .map((b) => b.textContent),
    );
    expect(botoes).toEqual([
      ["Marcar como lida", "Arquivar"],
      ["Voltar para nova", "Arquivar"],
      ["Desarquivar"],
    ]);
  });

  it("mostra tipo, data em Recife e status", () => {
    render(<ListaDeSugestoes sugestoes={[sugestao({ tipo: "problema" })]} agora={AGORA} total={1} />);

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Problema")).toBeTruthy();
    expect(within(item).getByText("Hoje, 14:32")).toBeTruthy();
    expect(within(item).getByText("Nova")).toBeTruthy();
  });

  it("filtro sem nada: 'Nada por aqui com esse filtro.'", () => {
    render(<ListaDeSugestoes sugestoes={[]} agora={AGORA} total={0} />);

    expect(screen.getByText("Nada por aqui com esse filtro.")).toBeTruthy();
  });

  it("acima do limite, avisa que mostra só as mais recentes", () => {
    render(<ListaDeSugestoes sugestoes={[sugestao({})]} agora={AGORA} total={1200} />);

    expect(screen.getByText("Mostrando as 1 mais recentes de 1.200.")).toBeTruthy();
  });
});

describe("FiltroDeStatus", () => {
  const contagem = { nova: 3, lida: 1, arquivada: 12 };
  const comTroca = (ui: React.ReactElement) => render(<TrocaDeFiltro>{ui}</TrocaDeFiltro>);

  it("cada chip envia o filtro que resulta de clicá-lo, com aria-pressed", () => {
    comTroca(<FiltroDeStatus ativos={["nova", "lida"]} contagem={contagem} />);

    const chip = (nome: RegExp) => screen.getByRole("button", { name: nome });
    expect(chip(/Novas/).getAttribute("aria-pressed")).toBe("true");
    expect(chip(/Novas/).getAttribute("value")).toBe("lida");
    expect(chip(/Arquivadas/).getAttribute("aria-pressed")).toBe("false");
    expect(chip(/Arquivadas/).getAttribute("value")).toBe("nova,lida,arquivada");
    expect(chip(/Arquivadas/).textContent).toBe("Arquivadas12");
  });

  it("o último chip ligado não desliga", () => {
    comTroca(<FiltroDeStatus ativos={["arquivada"]} contagem={contagem} />);

    const chip = screen.getByRole("button", { name: /Arquivadas/ });
    expect(chip.getAttribute("aria-disabled")).toBe("true");
    expect(chip.getAttribute("value")).toBe("arquivada");
  });

  it("sem JS, segue um form GET para a própria página", () => {
    const { container } = comTroca(<FiltroDeStatus ativos={["nova", "lida"]} contagem={contagem} />);

    const form = container.querySelector("form")!;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/admin/sugestoes");
  });

  it("com JS, clicar num chip navega para o filtro resultante sem recarregar nem rolar", () => {
    comTroca(<FiltroDeStatus ativos={["nova", "lida"]} contagem={contagem} />);

    // O listener do document roda depois do React: vê se o envio do documento foi barrado.
    let recarregaria: boolean | undefined;
    const aoEnviar = (e: Event) => (recarregaria = !e.defaultPrevented);
    document.addEventListener("submit", aoEnviar);
    fireEvent.click(screen.getByRole("button", { name: /Arquivadas/ }));
    document.removeEventListener("submit", aoEnviar);

    expect(push).toHaveBeenCalledWith("/admin/sugestoes?status=nova,lida,arquivada", { scroll: false });
    expect(recarregaria).toBe(false);
  });

  it("com JS, o chip travado não navega", () => {
    comTroca(<FiltroDeStatus ativos={["arquivada"]} contagem={contagem} />);

    fireEvent.click(screen.getByRole("button", { name: /Arquivadas/ }));

    expect(push).not.toHaveBeenCalled();
  });
});
