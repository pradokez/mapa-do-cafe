// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Edicao } from "@/lib/festival";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { EdicaoForm } from "./edicao-form";

const FESTIVAIS = [
  { id: "f1", slug: "eu-amo-cafe" as const, nome: "Eu Amo Café" },
  { id: "f2", slug: "recife-coffee" as const, nome: "Recife Coffee" },
];

const EDICAO: Edicao = {
  id: "6934bcef-f5ec-49f8-b8e2-da0e8b31c280",
  festival: { slug: "eu-amo-cafe", nome: "Eu Amo Café" },
  ano: 2026,
  inicio: "2026-10-18",
  fim: "2026-11-15",
  descricao: null,
  preco: 3490,
  publicada: true,
  participacoes: [],
};

// `<input type="date">` não aceita digitação no jsdom: o valor entra pelo change.
const data = (rotulo: RegExp, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EdicaoForm — cadastro", () => {
  it("sem festival e com fim antes do início, recusa sem chamar o servidor", async () => {
    const cadastrar = vi.fn();
    render(<EdicaoForm festivais={FESTIVAIS} cadastrar={cadastrar} />);

    data(/^Início/, "2027-05-10");
    data(/^Fim/, "2027-05-01");
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar edição" }));

    expect(screen.getByText("Escolha o festival.")).toBeTruthy();
    expect(screen.getByText("O fim não pode ser antes do início.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Festival"));
    expect(cadastrar).not.toHaveBeenCalled();
  });

  it("ano repetido vindo do servidor aparece no início; sucesso abre a edição", async () => {
    const cadastrar = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, erro: null, erros: { inicio: "Já existe Recife Coffee 2027." } })
      .mockResolvedValueOnce({ ok: true, id: "nova" });
    render(<EdicaoForm festivais={FESTIVAIS} cadastrar={cadastrar} />);

    await userEvent.selectOptions(screen.getByLabelText("Festival"), "recife-coffee");
    data(/^Início/, "2027-05-02");
    data(/^Fim/, "2027-06-06");
    await userEvent.type(screen.getByLabelText("Preço único do combo"), "45,90");
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar edição" }));

    expect(cadastrar).toHaveBeenCalledWith("recife-coffee", expect.objectContaining({ inicio: "2027-05-02", preco: "45,90" }));
    expect(screen.getByText("Já existe Recife Coffee 2027.")).toBeTruthy();
    expect(screen.getByText("Edição 2027 — o ano sai do início.")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar edição" }));
    expect(push).toHaveBeenCalledWith("/admin/festivais/nova?nova=1");
  });
});

describe("EdicaoForm — edição", () => {
  it("vem preenchida, sem escolha de festival, com o preço no formato do campo", () => {
    render(<EdicaoForm edicao={EDICAO} salvar={vi.fn()} />);

    expect(screen.queryByLabelText("Festival")).toBeNull();
    expect((screen.getByLabelText("Preço único do combo") as HTMLInputElement).value).toBe("34,90");
  });

  it("publicada, mudar o ano do início avisa que a página muda de endereço", () => {
    render(<EdicaoForm edicao={EDICAO} salvar={vi.fn()} />);

    data(/^Início/, "2027-10-18");

    expect(screen.getByText("Ao salvar, a página da edição muda para /festivais/eu-amo-cafe/2027.")).toBeTruthy();
  });

  it("salvar manda os campos e confirma que já está no site", async () => {
    const salvar = vi.fn().mockResolvedValue({ ok: true });
    render(<EdicaoForm edicao={EDICAO} salvar={salvar} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar dados" }));

    expect(salvar).toHaveBeenCalledWith({ inicio: "2026-10-18", fim: "2026-11-15", preco: "34,90", descricao: "" });
    expect(screen.getByRole("status").textContent).toBe("Salvo. A mudança já está no site.");
  });
});
