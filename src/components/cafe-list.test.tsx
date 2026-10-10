// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cafe } from "@/lib/cafe.fixture";

import { CafeList } from "./cafe-list";

afterEach(cleanup);

describe("CafeList — estado vazio", () => {
  it("recorte vazio mostra a xícara vazia e o botão limpa os filtros", async () => {
    const onLimpar = vi.fn();
    render(<CafeList cafes={[]} festivais={{}} onLimpar={onLimpar} />);

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
    render(<CafeList cafes={[]} festivais={{}} />);

    expect(screen.getByRole("heading", { name: "Xícara vazia por aqui" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });

  it.each([
    ["link junto ao contador", 0],
    ["botão do estado vazio", 1],
  ])("limpar pelo %s leva o foco para a lista, não para o topo da página", async (_, i) => {
    render(<CafeList cafes={[]} festivais={{}} onLimpar={() => {}} />);

    await userEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[i]);

    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Cafés" }));
  });

  it("com cafés no recorte, mostra a lista e não a xícara vazia", () => {
    render(<CafeList cafes={[cafe("1", { nome: "Café Um" })]} festivais={{}} onLimpar={() => {}} />);

    expect(screen.getByText("Café Um")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Xícara vazia por aqui" })).toBeNull();
  });
});

describe("CafeList — fotos", () => {
  it("só os 4 primeiros cards baixam a foto de cara; o resto espera a viewport", () => {
    const cafes = ["a", "b", "c", "d", "e", "f"].map((id) =>
      cafe(id, { fotos: [`https://x.supabase.co/storage/v1/object/public/cafe-fotos/${id}.webp`] }),
    );
    render(<CafeList cafes={cafes} festivais={{}} />);

    const lazy = cafes.map(({ id }) => screen.getByRole("img", { name: `Foto de ${id}` }).getAttribute("loading"));
    expect(lazy).toEqual([null, null, null, null, "lazy", "lazy"]);
  });
});
