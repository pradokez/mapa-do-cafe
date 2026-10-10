// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { Participacao } from "@/lib/festival";

const actions = vi.hoisted(() => ({
  adicionarParticipante: vi.fn(),
  salvarParticipante: vi.fn(),
  removerParticipante: vi.fn(),
}));
vi.mock("@/lib/admin/festivais-actions", () => actions);

import { ParticipantesEdicao } from "./participantes-edicao";

const EDICAO = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";

const CAFES = [
  cafe("borsoi", { nome: "Borsoi Café", bairro: "Pina" }),
  cafe("castigliani", { nome: "Castigliani", bairro: "Graças" }),
  cafe("cantinho", { nome: "Melhor Cantinho", bairro: "Várzea" }),
  cafe("fora", { nome: "Café Fechado", bairro: "Várzea", ativo: false }),
];

const participacao = (cafeId: string, campos: Partial<Participacao> = {}): Participacao => ({
  id: `p-${cafeId}`,
  cafe_id: cafeId,
  numero: null,
  nome_combo: null,
  alt: null,
  instagram_url: null,
  arte: null,
  ...campos,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const itens = () => screen.getAllByRole("listitem").filter((li) => li.querySelector("details"));

describe("ParticipantesEdicao", () => {
  it("mostra quem está sem número e sem arte, numerados primeiro", () => {
    render(
      <ParticipantesEdicao
        edicaoId={EDICAO}
        cafes={CAFES}
        participacoes={[
          participacao("borsoi"),
          participacao("castigliani", { numero: 2, arte: "https://x/a.webp", alt: "Combo 2" }),
        ]}
      />,
    );

    expect(screen.getByText("2 cafés · 1 sem número · 1 sem arte")).toBeTruthy();
    const [primeiro, segundo] = itens();
    expect(primeiro.textContent).toMatch(/Nº 2.*Castigliani/);
    expect(within(primeiro).queryByText("Sem número")).toBeNull();
    expect(within(primeiro).queryByText("Sem arte")).toBeNull();
    expect(within(segundo).getByText("Sem número")).toBeTruthy();
    expect(within(segundo).getByText("Sem arte")).toBeTruthy();
  });

  it("a busca mostra só cafés no ar que ainda não participam", async () => {
    render(<ParticipantesEdicao edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.type(screen.getByLabelText("Adicionar café"), "café");
    // "Borsoi Café" já participa e "Café Fechado" está fora do ar.
    expect(screen.queryByRole("list", { name: "Cafés para adicionar" })).toBeNull();
    expect(screen.getByText("Nenhum café no ar fora da edição com essa busca.")).toBeTruthy();
  });

  it("adicionar chama a action com o café e devolve o foco à busca", async () => {
    actions.adicionarParticipante.mockResolvedValue({ ok: true });
    render(<ParticipantesEdicao edicaoId={EDICAO} cafes={CAFES} participacoes={[]} />);

    const busca = screen.getByLabelText("Adicionar café");
    await userEvent.type(busca, "varzea");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar Melhor Cantinho" }));

    expect(actions.adicionarParticipante).toHaveBeenCalledWith(EDICAO, "cantinho");
    expect(document.activeElement).toBe(busca);
    expect(screen.getByRole("status").textContent).toBe("Melhor Cantinho entrou na edição.");
  });

  it("número repetido vindo do servidor aparece no campo", async () => {
    actions.salvarParticipante.mockResolvedValue({
      ok: false,
      erro: null,
      erros: { numero: "O número 2 já é de Castigliani." },
    });
    render(<ParticipantesEdicao edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.type(screen.getByLabelText("Número"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(actions.salvarParticipante).toHaveBeenCalledWith(EDICAO, "p-borsoi", expect.objectContaining({ numero: "2" }));
    expect(screen.getByText("O número 2 já é de Castigliani.")).toBeTruthy();
    expect(screen.getByLabelText("Número").getAttribute("aria-invalid")).toBe("true");
  });

  it("link de perfil é recusado antes de chegar ao servidor", async () => {
    render(<ParticipantesEdicao edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.type(screen.getByLabelText("Link do post no Instagram"), "instagram.com/borsoicafe");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText("Cole o link do post ou do reel no Instagram.")).toBeTruthy();
    expect(actions.salvarParticipante).not.toHaveBeenCalled();
  });

  it("tirar da edição pede confirmação, com o foco em Cancelar", async () => {
    actions.removerParticipante.mockResolvedValue({ ok: true });
    render(<ParticipantesEdicao edicaoId={EDICAO} cafes={CAFES} participacoes={[participacao("borsoi")]} />);

    await userEvent.click(screen.getByRole("button", { name: "Tirar da edição" }));
    const dialogo = screen.getByRole("alertdialog", { name: "Tirar Borsoi Café da edição?" });
    expect(document.activeElement?.textContent).toBe("Cancelar");
    expect(actions.removerParticipante).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Tirar da edição" }));
    expect(actions.removerParticipante).toHaveBeenCalledWith(EDICAO, "p-borsoi");
    expect(screen.getByRole("status").textContent).toBe("Borsoi Café saiu da edição.");
  });
});
