// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Cafe } from "@/lib/cafe";

import { CafeList } from "./cafe-list";

const FECHADO = "Fechado";
const CAFE: Cafe = {
  id: "1",
  slug: "cafe-um",
  nome: "Café Um",
  bairro: "Graças",
  bairro_slug: "gracas",
  endereco: "Rua X, 1",
  cidade: "Recife",
  lat: -8.05,
  lng: -34.9,
  selo_ascape: true,
  aceita_pets: false,
  tem_estacionamento: false,
  permite_coffee_office: false,
  faixa_preco: "$$",
  comodidades: [],
  horario_funcionamento: {
    segunda: FECHADO,
    terca: FECHADO,
    quarta: FECHADO,
    quinta: FECHADO,
    sexta: FECHADO,
    sabado: FECHADO,
    domingo: FECHADO,
  },
  instagram: null,
  telefone: null,
  fotos: [],
  ativo: true,
};

afterEach(cleanup);

describe("CafeList — estado vazio", () => {
  it("recorte vazio mostra a xícara vazia e o botão limpa os filtros", async () => {
    const onLimpar = vi.fn();
    render(<CafeList cafes={[]} onLimpar={onLimpar} />);

    expect(screen.getByRole("heading", { name: "Xícara vazia por aqui" })).toBeDefined();
    expect(
      screen.getByText("Nenhum café encontrado com esses filtros. Que tal explorar outros bairros?"),
    ).toBeDefined();

    // O link junto ao contador vem antes; o do estado vazio é o último.
    const botoes = screen.getAllByRole("button", { name: "Limpar filtros" });
    await userEvent.click(botoes[botoes.length - 1]);

    expect(onLimpar).toHaveBeenCalledOnce();
  });

  it("sem filtro ativo não oferece limpar: só a mensagem", () => {
    render(<CafeList cafes={[]} />);

    expect(screen.getByRole("heading", { name: "Xícara vazia por aqui" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });

  it.each([0, 1])("limpar (botão %i) leva o foco para a lista, não para o topo da página", async (i) => {
    render(<CafeList cafes={[]} onLimpar={() => {}} />);

    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[i]);

    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Cafés" }));
  });

  it("com cafés no recorte, mostra a lista e não a xícara vazia", () => {
    render(<CafeList cafes={[CAFE]} onLimpar={() => {}} />);

    expect(screen.getByText("Café Um")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Xícara vazia por aqui" })).toBeNull();
  });
});
