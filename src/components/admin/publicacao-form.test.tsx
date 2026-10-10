// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ definirPublicacao: vi.fn() }));
vi.mock("@/lib/admin/festivais-actions", () => actions);

import { PublicacaoForm } from "./publicacao-form";

const ID = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";
const BASE = { edicaoId: ID, nome: "Eu Amo Café 2026", periodo: "18 out a 15 nov 2026" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PublicacaoForm", () => {
  it("rascunho sem preço não oferece publicar e diz onde resolver", () => {
    render(<PublicacaoForm {...BASE} publicada={false} preco={null} />);

    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
    expect(screen.getByText("Para publicar, preencha o preço do combo em Dados.")).toBeTruthy();
  });

  it("publicar pede confirmação com o período, e só então grava", async () => {
    actions.definirPublicacao.mockResolvedValue({ ok: true });
    render(<PublicacaoForm {...BASE} publicada={false} preco={3490} />);

    await userEvent.click(screen.getByRole("button", { name: "Publicar" }));
    const dialogo = screen.getByRole("dialog", { name: "Publicar Eu Amo Café 2026?" });
    expect(dialogo.textContent).toMatch(/de 18 out a 15 nov 2026/);
    expect(actions.definirPublicacao).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    expect(actions.definirPublicacao).toHaveBeenCalledWith(ID, true);
    expect(screen.getByRole("status").textContent).toBe("Pronto: a edição está publicada.");
  });

  it("despublicar também confirma, e o erro do servidor fica no diálogo", async () => {
    actions.definirPublicacao.mockResolvedValue({ ok: false, erro: "Não deu para salvar agora." });
    render(<PublicacaoForm {...BASE} publicada preco={3490} />);

    await userEvent.click(screen.getByRole("button", { name: "Despublicar" }));
    const dialogo = screen.getByRole("dialog", { name: "Despublicar Eu Amo Café 2026?" });
    await userEvent.click(within(dialogo).getByRole("button", { name: "Despublicar" }));

    expect(actions.definirPublicacao).toHaveBeenCalledWith(ID, false);
    expect(within(dialogo).getByRole("alert").textContent).toBe("Não deu para salvar agora.");
  });
});
