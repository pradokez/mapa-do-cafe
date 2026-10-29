// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/revisoes-actions", () => ({ aprovarRevisao: vi.fn(), rejeitarRevisao: vi.fn() }));

import { LimiteDeEnvio } from "./decisoes-da-fila";

/** Faz o papel da action: ao clicar, o `fetch` rejeita e o React relança o erro no render. */
function Fila() {
  const [caiu, setCaiu] = useState(false);
  if (caiu) throw new TypeError("Failed to fetch");
  return <button onClick={() => setCaiu(true)}>Aprovar</button>;
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("queda de rede numa decisão da fila (#191)", () => {
  it("troca a fila por um aviso com o foco, em vez de derrubar a página", () => {
    render(
      <LimiteDeEnvio>
        <Fila />
      </LimiteDeEnvio>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    const aviso = screen.getByRole("alert");
    expect(aviso.textContent).toContain("Não deu para enviar.");
    expect(aviso.textContent).toContain("Nada foi gravado.");
    expect(document.activeElement).toBe(aviso);
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
  });

  it("'Tentar de novo' devolve a fila, pronta para decidir outra vez", () => {
    render(
      <LimiteDeEnvio>
        <Fila />
      </LimiteDeEnvio>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeTruthy();
  });
});
