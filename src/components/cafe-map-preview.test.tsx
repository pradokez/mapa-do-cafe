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

describe("CafeMapPreview — horário de agora", () => {
  it("repete a linha do card", () => {
    // 2026-10-08, quinta, 10:00 em Recife.
    const base = cafe("fiore");
    const horario = { ...base.horario_funcionamento, quinta: "08:00 – 18:00" };
    render(
      <CafeMapPreview
        cafe={{ ...base, horario_funcionamento: horario }}
        agora={new Date("2026-10-08T13:00:00Z")}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("link").textContent).toContain("Aberto até 18h");
  });
});
