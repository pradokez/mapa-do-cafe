// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  prepararUpload: vi.fn(),
  registrarFoto: vi.fn(),
  descartarUpload: vi.fn(),
}));
vi.mock("@/lib/admin/fotos-actions", () => actions);

import { FotoUploadForm } from "./foto-upload-form";

const CAFE = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FotoUploadForm", () => {
  it("origem começa sem escolha e a data da autorização começa em hoje (sem futuro)", () => {
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    expect(screen.getByRole("radio", { name: "Própria" })).toHaveProperty("checked", false);
    expect(screen.getByRole("radio", { name: "Cedida pelo café" })).toHaveProperty("checked", false);
    const data = screen.getByLabelText("Data da autorização");
    expect(data).toHaveProperty("value", "2026-10-04");
    expect(data.getAttribute("max")).toBe("2026-10-04");
  });

  it("sem foto, origem e quem autorizou, nada é enviado — e cada erro fica ligado ao campo", async () => {
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await userEvent.click(screen.getByRole("button", { name: "Enviar foto" }));

    expect(actions.prepararUpload).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Foto").getAttribute("aria-describedby")).toContain("erro-foto");
    expect(screen.getByText("Escolha uma foto.").id).toBe("erro-foto");
    expect(screen.getByRole("group", { name: "Origem" }).getAttribute("aria-describedby")).toBe("erro-origem");
    expect(screen.getByText("Escolha a origem da foto.").id).toBe("erro-origem");
    const autorizadoPor = screen.getByLabelText("Quem autorizou");
    expect(autorizadoPor.getAttribute("aria-invalid")).toBe("true");
    expect(autorizadoPor.getAttribute("aria-describedby")).toBe("erro-autorizado_por");
    expect(screen.getByText("Diga quem autorizou.")).toBeTruthy();
  });

  it("arquivo fora de JPEG/PNG/WebP é recusado na hora, antes de qualquer envio", async () => {
    render(<FotoUploadForm cafeId={CAFE} hoje="2026-10-04" />);

    await userEvent.upload(
      screen.getByLabelText("Foto"),
      new File(["x"], "foto.heic", { type: "image/heic" }),
      { applyAccept: false },
    );

    expect(screen.getByText("Use uma foto JPEG, PNG ou WebP.").id).toBe("erro-foto");
    expect(actions.prepararUpload).not.toHaveBeenCalled();
  });
});
