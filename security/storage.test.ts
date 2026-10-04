import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { anonClient, serviceClient } from "./clients";
import { motivoSemEscrita, PODE_ESCREVER } from "./env";

/**
 * Bucket `cafe-fotos` (#59): público para ler (o site mostra as fotos), mas só
 * admin grava e remove, e só `image/webp` até 2 MB entra. Aqui um atacante
 * tenta subir direto com a publishable key e subir conteúdo malicioso.
 * Ver docs/security/pentest-2026-10.md.
 */

const BUCKET = "cafe-fotos";
const escrita = PODE_ESCREVER ? describe : describe.skip;

if (!PODE_ESCREVER) console.warn(`[security] Storage pulado: ${motivoSemEscrita}`);

const webp = () => new Blob([Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])], { type: "image/webp" });

escrita("Storage — escrita só para admin, só WebP ≤ 2 MB", () => {
  it("anônimo não sobe arquivo no bucket", async () => {
    const caminho = `${randomUUID()}/${randomUUID()}.webp`;
    const { error } = await anonClient().storage.from(BUCKET).upload(caminho, webp());
    expect(error).not.toBeNull();
  });

  it("anônimo não remove arquivo do bucket", async () => {
    // Sobe um de verdade pela secret key, e tenta remover como anônimo.
    const caminho = `${randomUUID()}/${randomUUID()}.webp`;
    const service = serviceClient();
    await service.storage.from(BUCKET).upload(caminho, webp());
    const { data } = await anonClient().storage.from(BUCKET).remove([caminho]);
    // O endpoint responde, mas o objeto continua lá.
    expect(data ?? []).toEqual([]);
    const { data: ainda } = await service.storage.from(BUCKET).list(caminho.split("/")[0]);
    expect((ainda ?? []).length).toBe(1);
    await service.storage.from(BUCKET).remove([caminho]);
  });

  it("o bucket recusa um content-type que não é image/webp (SVG, HTML)", async () => {
    const base = randomUUID();
    const svg = new Blob(["<svg onload=alert(1)>"], { type: "image/svg+xml" });
    const html = new Blob(["<html><script>alert(1)</script>"], { type: "text/html" });
    const a = await serviceClient().storage.from(BUCKET).upload(`${base}/a.webp`, svg);
    const b = await serviceClient().storage.from(BUCKET).upload(`${base}/b.webp`, html);
    expect(a.error).not.toBeNull();
    expect(b.error).not.toBeNull();
  });

  it("o bucket recusa arquivo acima de 2 MB", async () => {
    const caminho = `${randomUUID()}/${randomUUID()}.webp`;
    const grande = new Blob([new Uint8Array(2_100_000)], { type: "image/webp" });
    const { error } = await serviceClient().storage.from(BUCKET).upload(caminho, grande);
    expect(error).not.toBeNull();
  });

  it("URL assinada é presa ao caminho: não serve para subir em outro", async () => {
    const service = serviceClient();
    const cafe = randomUUID();
    const caminho = `${cafe}/${randomUUID()}.webp`;
    const { data: assinada, error } = await service.storage.from(BUCKET).createSignedUploadUrl(caminho);
    expect(error).toBeNull();

    // O mesmo token num caminho diferente (pasta de outro café) é recusado.
    const outro = `${randomUUID()}/${randomUUID()}.webp`;
    const forjado = await service.storage.from(BUCKET).uploadToSignedUrl(outro, assinada!.token, webp());
    expect(forjado.error).not.toBeNull();

    // No caminho certo, funciona uma vez…
    const ok = await service.storage.from(BUCKET).uploadToSignedUrl(caminho, assinada!.token, webp());
    expect(ok.error).toBeNull();
    // …e reusar o token já gasto falha (não sobrescreve).
    const reuso = await service.storage.from(BUCKET).uploadToSignedUrl(caminho, assinada!.token, webp());
    expect(reuso.error).not.toBeNull();

    await service.storage.from(BUCKET).remove([caminho]);
  });
});
