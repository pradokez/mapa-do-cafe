// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cafe } from "@/lib/cafe.fixture";
import type { FestivaisNoAr } from "@/lib/festival";

import { CafeCard } from "./cafe-card";

afterEach(cleanup);

// 2026-10-08 é uma quinta-feira; 17:40 em Recife (UTC−3).
const AGORA = new Date("2026-10-08T20:40:00Z");

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
    render(<CafeCard agora={AGORA} cafe={cafe("1", { nome })} />);

    const titulo = screen.getByRole("heading", { name: nome });
    expect(titulo.getAttribute("title")).toBe(nome);
  });

  it("o nome é o link para o detalhe", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("fiore", { nome: "Fiore" })} />);

    expect(screen.getByRole("link", { name: "Fiore" }).getAttribute("href")).toBe("/cafes/fiore");
  });
});

describe("CafeCard — selos", () => {
  const OS_DOIS: FestivaisNoAr = { "recife-coffee": ["1"], "eu-amo-cafe": ["1"] };

  it("mostra o selo de cada festival no ar de que o café participa", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("1")} festivais={OS_DOIS} />);

    expect(screen.getAllByText("Recife Coffee").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Eu Amo Café").length).toBeGreaterThan(0);
  });

  it("sem selo de festival fora do ar, nem de festival de que o café não participa", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("1")} festivais={{ "eu-amo-cafe": ["2"] }} />);
    expect(screen.queryByText("Eu Amo Café")).toBeNull();
    expect(screen.queryByText("Recife Coffee")).toBeNull();

    cleanup();
    render(<CafeCard agora={AGORA} cafe={cafe("1")} />);
    expect(screen.queryByText("Eu Amo Café")).toBeNull();
  });

  it("selos ficam na foto, fora da linha de comodidades", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("1", { aceita_pets: true })} festivais={OS_DOIS} />);

    const lista = comodidades();
    expect(within(lista).queryByText("Recife Coffee")).toBeNull();
    expect(within(lista).queryByText("Eu Amo Café")).toBeNull();
  });
});

describe("CafeCard — comodidades", () => {
  it("ar-condicionado só aparece quando é true: null (sem informação) some, como false", () => {
    const { rerender } = render(<CafeCard agora={AGORA} cafe={cafe("1", { tem_ar_condicionado: true })} />);
    expect(within(comodidades()).queryAllByText("Ar-condicionado")).not.toHaveLength(0);

    rerender(<CafeCard agora={AGORA} cafe={cafe("1", { tem_ar_condicionado: null })} />);
    expect(within(comodidades()).queryAllByText("Ar-condicionado")).toHaveLength(0);
  });

  it("com até 5 comodidades, todas aparecem e não há \"+N\"", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("1", { ...SEIS, tem_ar_condicionado: null })} />);

    expect(within(comodidades()).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /e mais/ })).toBeNull();
  });

  it("com 6, o mobile corta em 4 e o \"+2\" diz quais ficaram de fora", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("1", SEIS)} />);

    const mais = screen.getByRole("button", { name: "e mais 2: Opções vegetarianas, Ar-condicionado" });
    expect(mais.textContent).toContain("+2");
  });

  it("card sem nenhuma comodidade mantém a linha, vazia", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("1")} />);

    expect(within(comodidades()).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("CafeCard — foto", () => {
  const URL_FOTO = "https://x.supabase.co/storage/v1/object/public/cafe-fotos/a/b.webp";

  it("foto real sai direto do Storage, com alt descritivo e lazy", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("fiore", { nome: "Fiore", fotos: [URL_FOTO] })} />);

    const foto = screen.getByRole("img", { name: "Foto de Fiore" });
    expect(foto.getAttribute("src")).toBe(URL_FOTO);
    expect(foto.getAttribute("loading")).toBe("lazy");
  });

  it("com priority, a foto não espera chegar perto da viewport", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("fiore", { nome: "Fiore", fotos: [URL_FOTO] })} priority />);

    expect(screen.getByRole("img", { name: "Foto de Fiore" }).hasAttribute("loading")).toBe(false);
  });

  it("café sem foto fica com o placeholder, sem imagem", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("fiore", { nome: "Fiore" })} />);

    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("CafeCard — horário de agora", () => {
  const semana = (quinta: string | undefined, resto = "08:00 – 18:00") => ({
    segunda: resto,
    terca: resto,
    quarta: resto,
    ...(quinta === undefined ? {} : { quinta }),
    sexta: resto,
    sabado: resto,
    domingo: "Fechado",
  });
  const comHorario = (horario: Record<string, string>) =>
    render(<CafeCard agora={AGORA} cafe={cafe("1", { horario_funcionamento: horario })} />);

  it("aberto: até que horas", () => {
    comHorario(semana("08:00 – 20:00"));
    expect(screen.getByText("Aberto até 20h")).toBeTruthy();
  });

  it("faltando 30 min ou menos: \"Fecha em N min\" em terracota", () => {
    comHorario(semana("08:00 – 18:00"));
    expect(screen.getByText("Fecha em 20 min").closest("[data-horario]")?.className).toContain("text-terracotta");
  });

  it("fechado com próxima abertura: quando abre", () => {
    comHorario(semana("08:00 – 12:00, 19:00 – 22:00"));
    expect(screen.getByText("Abre às 19h")).toBeTruthy();

    cleanup();
    comHorario(semana("08:00 – 17:00"));
    expect(screen.getByText("Abre amanhã às 8h")).toBeTruthy();
  });

  it("fechado a semana toda: só \"Fechado\"", () => {
    render(<CafeCard agora={AGORA} cafe={cafe("1")} />);
    expect(screen.getByText("Fechado")).toBeTruthy();
  });

  it("sem informação hoje: nenhum estado, nem \"Fechado\", e a linha continua reservada", () => {
    comHorario(semana(undefined));
    expect(screen.queryByText(/^(Aberto|Abre|Fecha|Fechado)/)).toBeNull();
    expect(document.querySelector("[data-horario]")?.getAttribute("aria-hidden")).toBe("true");
  });
});
