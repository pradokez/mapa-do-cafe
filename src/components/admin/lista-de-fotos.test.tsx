// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  reordenarFoto: vi.fn(),
  removerFoto: vi.fn(),
  marcarTemporaria: vi.fn(),
}));
vi.mock("@/lib/admin/fotos-actions", () => actions);

import type { FotoDoCafe } from "@/lib/cafe-repository";

import { ListaDeFotos } from "./lista-de-fotos";

const CAFE = "6934bcef-f5ec-49f8-b8e2-da0e8b31c280";

function foto(n: number, extra: Partial<FotoDoCafe> = {}): FotoDoCafe {
  const id = `00000000-0000-4000-8000-00000000000${n}`;
  return {
    id,
    storage_path: `${CAFE}/${id}.webp`,
    ordem: n - 1,
    temporaria: false,
    url: `https://xyz.supabase.co/storage/v1/object/public/cafe-fotos/${CAFE}/${id}.webp`,
    origem: "propria",
    autorizado_por: "Keziah",
    autorizado_em: "2026-10-01",
    observacao: null,
    ...extra,
  };
}

const TRES = [
  foto(1),
  foto(2, { origem: "cedida", autorizado_por: "Ana, dona do café", observacao: "Só no site, com crédito." }),
  foto(3),
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ListaDeFotos", () => {
  it("mostra a autorização de cada foto: origem, quem, quando (pt-BR) e a observação", () => {
    render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    const segunda = screen.getAllByRole("listitem")[1];
    expect(within(segunda).getByText("Cedida pelo café")).toBeTruthy();
    expect(within(segunda).getByText(/Ana, dona do café/)).toBeTruthy();
    expect(within(segunda).getByText(/01\/10\/2026/)).toBeTruthy();
    expect(within(segunda).getByText("Só no site, com crédito.")).toBeTruthy();
  });

  it("cada foto tem subir, descer, capa e remover com rótulo próprio; nas bordas, o que não cabe não age", () => {
    render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    expect(screen.getByRole("button", { name: "Subir foto 1 de 3" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Descer foto 3 de 3" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Descer foto 1 de 3" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByRole("button", { name: "Usar foto 1 de 3 como capa" })).toBeNull();
    expect(screen.getByRole("button", { name: "Usar foto 2 de 3 como capa" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Remover foto \d de 3$/ })).toHaveLength(3);
  });

  it("descer chama a action e, com a lista nova do servidor, o foco segue a foto e a posição é anunciada", async () => {
    actions.reordenarFoto.mockResolvedValue({ ok: true });
    const { rerender } = render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Descer foto 1 de 3" }));
    expect(actions.reordenarFoto).toHaveBeenCalledWith(CAFE, TRES[0].id, "descer");

    // O `revalidatePath` da action traz a página de novo, com a ordem nova.
    rerender(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={[TRES[1], TRES[0], TRES[2]]} />);

    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Descer foto 2 de 3"));
    expect(screen.getByRole("status").textContent).toBe("Foto movida para a posição 2 de 3.");
  });

  it("usar como capa: o botão some na foto nova capa, e o foco vai para o primeiro que ainda age", async () => {
    actions.reordenarFoto.mockResolvedValue({ ok: true });
    const { rerender } = render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Usar foto 3 de 3 como capa" }));
    expect(actions.reordenarFoto).toHaveBeenCalledWith(CAFE, TRES[2].id, "capa");
    rerender(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={[TRES[2], TRES[0], TRES[1]]} />);

    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Descer foto 1 de 3"));
    expect(screen.getByRole("status").textContent).toBe("Foto agora é a capa.");
  });

  it("erro do servidor ao reordenar aparece e nada é anunciado", async () => {
    actions.reordenarFoto.mockResolvedValue({ ok: false, erro: "Não deu para mudar a ordem agora." });
    render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Subir foto 2 de 3" }));

    expect(screen.getByRole("alert").textContent).toBe("Não deu para mudar a ordem agora.");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("remover pede confirmação com a miniatura; cancelar não remove e devolve o foco", async () => {
    render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover foto 2 de 3" }));
    const dialogo = screen.getByRole("alertdialog", { name: "Remover esta foto?" });
    expect(within(dialogo).getByRole("img").getAttribute("src")).toBe(TRES[1].url);
    expect(document.activeElement?.textContent).toBe("Cancelar");

    await userEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(actions.removerFoto).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Remover foto 2 de 3"));
  });

  it("confirmar remove e leva o foco à foto que ficou no lugar", async () => {
    actions.removerFoto.mockResolvedValue({ ok: true });
    const { rerender } = render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover foto 2 de 3" }));
    await userEvent.click(screen.getByRole("button", { name: "Remover foto" }));
    expect(actions.removerFoto).toHaveBeenCalledWith(CAFE, TRES[1].id);
    rerender(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={[TRES[0], TRES[2]]} />);

    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Subir foto 2 de 2"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Foto removida.");
  });

  it("removida a última foto, volta o aviso do placeholder, com o foco nele", async () => {
    actions.removerFoto.mockResolvedValue({ ok: true });
    const { rerender } = render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={[TRES[0]]} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover foto 1 de 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Remover foto" }));
    rerender(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={[]} />);

    const vazio = screen.getByText(/o café aparece com o placeholder listrado/);
    await waitFor(() => expect(document.activeElement).toBe(vazio));
  });

  it("falha na remoção fica no diálogo, que continua aberto", async () => {
    actions.removerFoto.mockResolvedValue({ ok: false, erro: "Não deu para remover a foto agora." });
    render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Remover foto 1 de 3" }));
    await userEvent.click(screen.getByRole("button", { name: "Remover foto" }));

    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByRole("alert").textContent).toBe("Não deu para remover a foto agora.");
  });

  it("action que não responde (rede caiu) vira erro genérico e libera os botões", async () => {
    actions.reordenarFoto.mockRejectedValue(new Error("fetch failed"));
    render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Descer foto 1 de 3" }));

    expect(screen.getByRole("alert").textContent).toBe("Não deu para salvar agora. Tente de novo em instantes.");
    expect(screen.getByRole("button", { name: "Descer foto 1 de 3" }).hasAttribute("disabled")).toBe(false);
  });

  it("foto temporária (#92): etiqueta só nela, e o botão diz o que vai acontecer", () => {
    render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={[foto(1), foto(2, { temporaria: true })]} />);

    const [primeira, segunda] = screen.getAllByRole("listitem");
    expect(within(primeira).queryByText("Temporária")).toBeNull();
    expect(within(segunda).getByText("Temporária")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marcar foto 1 de 2 como temporária" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marcar foto 2 de 2 como definitiva" })).toBeTruthy();
  });

  it("marcar chama a action com o estado-alvo e, com a lista nova, o foco fica no botão e a mudança é anunciada", async () => {
    actions.marcarTemporaria.mockResolvedValue({ ok: true });
    const { rerender } = render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Marcar foto 2 de 3 como temporária" }));
    expect(actions.marcarTemporaria).toHaveBeenCalledWith(CAFE, TRES[1].id, true);

    rerender(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={[TRES[0], { ...TRES[1], temporaria: true }, TRES[2]]} />);

    await waitFor(() =>
      expect(document.activeElement?.getAttribute("aria-label")).toBe("Marcar foto 2 de 3 como definitiva"),
    );
    expect(screen.getByRole("status").textContent).toBe("Foto marcada como temporária.");
  });

  it("erro ao marcar aparece e nada é anunciado", async () => {
    actions.marcarTemporaria.mockResolvedValue({ ok: false, erro: "Não deu." });
    render(<ListaDeFotos cafeId={CAFE} nome="Café Teste" fotos={TRES} />);

    await userEvent.click(screen.getByRole("button", { name: "Marcar foto 1 de 3 como temporária" }));
    expect(await screen.findByText("Não deu.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
