// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { resolveCafePhotos } from "@/lib/cafe-photos";

import { CafePhotoFrame } from "./cafe-photo-frame";

afterEach(cleanup);

const foto = (n: number) => ({ kind: "url" as const, src: `https://x.supabase.co/storage/v1/object/public/cafe-fotos/a/${n}.webp` });
const brilho = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-skeleton]");

describe("CafePhotoFrame — foto do Storage chegando", () => {
  it("enquanto carrega, a moldura brilha e a foto ainda não aparece", () => {
    const { container } = render(<CafePhotoFrame photo={foto(1)} alt="Foto de Fiore" />);

    expect(brilho(container)?.dataset.skeleton).toBe("");
    expect(brilho(container)?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole("img", { name: "Foto de Fiore" }).className).toContain("opacity-0");
  });

  // O `next/image` chama `onLoad` depois do `decode()`: assíncrono.
  it("quando a foto chega, o brilho sai e ela entra com fade (só com movimento liberado)", async () => {
    const { container } = render(<CafePhotoFrame photo={foto(1)} alt="Foto de Fiore" />);
    const img = screen.getByRole("img", { name: "Foto de Fiore" });

    fireEvent.load(img);

    await waitFor(() => expect(brilho(container)).toBeNull());
    expect(img.className).not.toContain("opacity-0");
    expect(img.className).toContain("motion-safe:transition-opacity");
  });

  it("se a foto falha, o brilho fica parado e a imagem quebrada não aparece", () => {
    const { container } = render(<CafePhotoFrame photo={foto(1)} alt="Foto de Fiore" />);
    const img = screen.getByRole("img", { name: "Foto de Fiore" });

    fireEvent.error(img);

    expect(brilho(container)?.dataset.skeleton).toBe("parado");
    expect(img.className).toContain("opacity-0");
  });

  it("trocar de foto (o preview do mapa muda de café) volta a brilhar até a nova chegar", async () => {
    const { container, rerender } = render(<CafePhotoFrame photo={foto(1)} alt="" />);
    fireEvent.load(container.querySelector("img")!);
    await waitFor(() => expect(brilho(container)).toBeNull());

    rerender(<CafePhotoFrame photo={foto(2)} alt="" />);

    expect(brilho(container)?.dataset.skeleton).toBe("");
    expect(container.querySelector("img")!.className).toContain("opacity-0");
  });

  it("placeholder listrado não brilha: já chega pronto", () => {
    const { container } = render(<CafePhotoFrame photo={resolveCafePhotos({ id: "x", fotos: [] })[0]} />);

    expect(brilho(container)).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});
