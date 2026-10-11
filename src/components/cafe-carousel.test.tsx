// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { resolveCafePhotos } from "@/lib/cafe-photos";
import { cafe } from "@/lib/cafe.fixture";

import { CafeCarousel } from "./cafe-carousel";

afterEach(cleanup);

const fotos = [1, 2, 3, 4, 5].map((n) => `https://x.supabase.co/storage/v1/object/public/cafe-fotos/${n}.webp`);
const carregamento = () =>
  screen.getAllByRole("img", { hidden: true }).map((img) => img.getAttribute("loading") ?? "já");

describe("CafeCarousel — fotos", () => {
  it("fotos reais têm alt com o nome do café", () => {
    render(<CafeCarousel photos={resolveCafePhotos(cafe("1", { fotos }))} nome="Fiore" />);

    expect(screen.getAllByRole("img", { hidden: true, name: "Foto de Fiore" })).toHaveLength(5);
  });

  it("carrega a foto à vista e as vizinhas (dando a volta); as outras esperam", async () => {
    render(<CafeCarousel photos={resolveCafePhotos(cafe("1", { fotos }))} nome="Fiore" />);

    expect(carregamento()).toEqual(["já", "eager", "lazy", "lazy", "eager"]);

    await userEvent.click(screen.getByRole("button", { name: "Próxima foto" }));

    // A 3ª virou vizinha: começa a baixar antes de alguém deslizar até ela.
    expect(carregamento()[2]).toBe("eager");
  });
});

describe("CafeCarousel — só as fotos que existem", () => {
  const slides = () => screen.getAllByRole("group", { hidden: true });
  const semControles = () => {
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();
    expect(screen.queryByText(/^Foto \d+ de \d+$/)).toBeNull();
  };

  it("com uma foto: só ela, sem contador, setas nem dots, e ←/→ não mudam nada", async () => {
    render(<CafeCarousel photos={resolveCafePhotos(cafe("1", { fotos: fotos.slice(0, 1) }))} nome="Fiore" />);

    expect(slides()).toHaveLength(1);
    semControles();

    screen.getByRole("region", { name: "Fotos de Fiore" }).focus();
    await userEvent.keyboard("{ArrowRight}{ArrowLeft}{ArrowRight}");
    expect(slides()[0].getAttribute("aria-hidden")).toBe("false");
  });

  it("sem foto: um placeholder com a legenda, sem controles", () => {
    render(<CafeCarousel photos={resolveCafePhotos(cafe("1", { fotos: [] }))} nome="Fiore" />);

    expect(slides()).toHaveLength(1);
    screen.getByText("foto · Fiore");
    semControles();
  });

  it("com três fotos: contador de três, três dots e nenhum slide de placeholder", () => {
    render(<CafeCarousel photos={resolveCafePhotos(cafe("1", { fotos: fotos.slice(0, 3) }))} nome="Fiore" />);

    expect(slides()).toHaveLength(3);
    screen.getByText("1 / 3");
    expect(screen.getAllByRole("button", { name: /^Foto \d de 3$/ })).toHaveLength(3);
    expect(screen.queryByText("foto · Fiore")).toBeNull();
  });
});
