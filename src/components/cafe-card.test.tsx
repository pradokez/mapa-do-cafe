// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { FestivaisNoAr } from "@/lib/festival";

import { CafeCard } from "./cafe-card";

afterEach(cleanup);

const SEIS = {
  aceita_pets: true,
  tem_estacionamento: true,
  permite_coffee_office: true,
  acessivel_pcd: true,
  opcoes_vegetarianas: true,
  tem_ar_condicionado: true,
};

const comodidades = () => screen.getByRole("list", { name: "Comodidades" });

describe("CafeCard — nome", () => {
  it("nome longo continua inteiro para leitor de tela e aparece no hover", () => {
    const nome = "O Melhor Cantinho de Café Especial da Cidade do Recife e Arredores";
    render(<CafeCard cafe={cafe("1", { nome })} />);

    const titulo = screen.getByRole("heading", { name: nome });
    expect(titulo.getAttribute("title")).toBe(nome);
  });

  it("o nome é o link para o detalhe", () => {
    render(<CafeCard cafe={cafe("fiore", { nome: "Fiore" })} />);

    expect(screen.getByRole("link", { name: "Fiore" }).getAttribute("href")).toBe("/cafes/fiore");
  });
});

describe("CafeCard — selos", () => {
  const OS_DOIS: FestivaisNoAr = { "recife-coffee": ["1"], "eu-amo-cafe": ["1"] };

  it("mostra o selo de cada festival no ar de que o café participa", () => {
    render(<CafeCard cafe={cafe("1")} festivais={OS_DOIS} />);

    expect(screen.getAllByText("Recife Coffee").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Eu Amo Café").length).toBeGreaterThan(0);
  });

  it("sem selo de festival fora do ar, nem de festival de que o café não participa", () => {
    render(<CafeCard cafe={cafe("1")} festivais={{ "eu-amo-cafe": ["2"] }} />);
    expect(screen.queryByText("Eu Amo Café")).toBeNull();
    expect(screen.queryByText("Recife Coffee")).toBeNull();

    cleanup();
    render(<CafeCard cafe={cafe("1")} />);
    expect(screen.queryByText("Eu Amo Café")).toBeNull();
  });

  it("selos ficam na foto, fora da linha de comodidades", () => {
    render(<CafeCard cafe={cafe("1", { aceita_pets: true })} festivais={OS_DOIS} />);

    const lista = comodidades();
    expect(within(lista).queryByText("Recife Coffee")).toBeNull();
    expect(within(lista).queryByText("Eu Amo Café")).toBeNull();
  });
});

describe("CafeCard — comodidades", () => {
  it("ar-condicionado só aparece quando é true: null (sem informação) some, como false", () => {
    const { rerender } = render(<CafeCard cafe={cafe("1", { tem_ar_condicionado: true })} />);
    expect(within(comodidades()).queryAllByText("Ar-condicionado")).not.toHaveLength(0);

    rerender(<CafeCard cafe={cafe("1", { tem_ar_condicionado: null })} />);
    expect(within(comodidades()).queryAllByText("Ar-condicionado")).toHaveLength(0);
  });

  it("com até 5 comodidades, todas aparecem e não há \"+N\"", () => {
    render(<CafeCard cafe={cafe("1", { ...SEIS, tem_ar_condicionado: null })} />);

    expect(within(comodidades()).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /e mais/ })).toBeNull();
  });

  it("com 6, o mobile corta em 4 e o \"+2\" diz quais ficaram de fora", () => {
    render(<CafeCard cafe={cafe("1", SEIS)} />);

    const mais = screen.getByRole("button", { name: "e mais 2: Opções vegetarianas, Ar-condicionado" });
    expect(mais.textContent).toContain("+2");
  });

  it("card sem nenhuma comodidade mantém a linha, vazia", () => {
    render(<CafeCard cafe={cafe("1")} />);

    expect(within(comodidades()).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("CafeCard — foto", () => {
  const URL_FOTO = "https://x.supabase.co/storage/v1/object/public/cafe-fotos/a/b.webp";

  it("foto real sai direto do Storage, com alt descritivo e lazy", () => {
    render(<CafeCard cafe={cafe("fiore", { nome: "Fiore", fotos: [URL_FOTO] })} />);

    const foto = screen.getByRole("img", { name: "Foto de Fiore" });
    expect(foto.getAttribute("src")).toBe(URL_FOTO);
    expect(foto.getAttribute("loading")).toBe("lazy");
  });

  it("com priority, a foto não espera chegar perto da viewport", () => {
    render(<CafeCard cafe={cafe("fiore", { nome: "Fiore", fotos: [URL_FOTO] })} priority />);

    expect(screen.getByRole("img", { name: "Foto de Fiore" }).hasAttribute("loading")).toBe(false);
  });

  it("café sem foto fica com o placeholder, sem imagem", () => {
    render(<CafeCard cafe={cafe("fiore", { nome: "Fiore" })} />);

    expect(screen.queryByRole("img")).toBeNull();
  });
});
