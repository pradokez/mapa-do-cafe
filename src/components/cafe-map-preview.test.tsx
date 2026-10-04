// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cafe } from "@/lib/cafe.fixture";

import { CafeMapPreview } from "./cafe-map-preview";

afterEach(cleanup);

describe("CafeMapPreview — foto", () => {
  it("a foto fica dentro do link, que já tem o nome: alt vazio", () => {
    const fotos = ["https://x.supabase.co/storage/v1/object/public/cafe-fotos/a.webp"];
    render(<CafeMapPreview cafe={cafe("fiore", { nome: "Fiore", fotos })} onClose={() => {}} />);

    const link = screen.getByRole("link");
    expect(link.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});
