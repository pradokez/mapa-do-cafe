/**
 * Pix do "Me paga um café?" (#120, PRD #119): o copia e cola do QR estático
 * (BR Code, EMV MPM do Banco Central), montado no site a partir da chave
 * aleatória do Inter — um código por valor, sem imagem para manter. Puro: não
 * importa React. Quem decide o formato é o copia e cola que o app do Inter gera
 * (teste-âncora em `pix.test.ts`), não a leitura do manual.
 */

/** O valor do apoio em reais; `null` é o "Livre": o valor fica para o app do banco. */
export type ValorDeApoio = number | null;

export const VALORES_DE_APOIO: readonly ValorDeApoio[] = [5, 10, 20, null];
export const VALOR_PADRAO: ValorDeApoio = 5;

export function rotuloDoValor(valor: ValorDeApoio): string {
  return valor === null ? "Livre" : `R$ ${valor}`;
}

export type ConfigDoPix = { chave: string; nome: string; cidade: string };

// Os do copia e cola do Inter (campos 59 e 60): a cidade é a do cadastro no banco.
const NOME_PADRAO = "KEZIAH OLIVEIRA PRADO";
const CIDADE_PADRAO = "FORTALEZA";

// O campo 26 vai até 99: GUI (`0014br.gov.bcb.pix`, 18) + `01` e o tamanho (4).
const MAX_CHAVE = 77;
const MAX_NOME = 25;
const MAX_CIDADE = 15;

/**
 * Lê `PIX_CHAVE`, `PIX_NOME` e `PIX_CIDADE` (só servidor: sem `NEXT_PUBLIC_`).
 * Sem chave, ou com uma que não cabe no código, `null`: o botão não aparece,
 * em vez de mostrar um QR que o banco recusa.
 */
export function configDoPix(env: Partial<Record<string, string>> = process.env): ConfigDoPix | null {
  const chave = env.PIX_CHAVE?.trim();
  if (!chave || chave.length > MAX_CHAVE) return null;
  return {
    chave,
    nome: env.PIX_NOME?.trim() || NOME_PADRAO,
    cidade: env.PIX_CIDADE?.trim() || CIDADE_PADRAO,
  };
}

/** O copia e cola do Pix estático, na ordem de campos do Inter. */
export function brCodePix({ chave, nome, cidade, valor }: ConfigDoPix & { valor: ValorDeApoio }): string {
  const semCrc = [
    tlv("00", "01"), // versão do payload
    tlv("01", "11"), // QR estático (pode ser pago mais de uma vez)
    tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", chave)),
    tlv("52", "0000"), // MCC
    tlv("53", "986"), // real
    valor === null ? "" : tlv("54", valor.toFixed(2)),
    tlv("58", "BR"),
    tlv("59", textoDoCampo(nome, MAX_NOME)),
    tlv("60", textoDoCampo(cidade, MAX_CIDADE)),
    tlv("62", tlv("05", "***")), // sem txid: o estático não identifica o pagamento
    "6304",
  ].join("");
  return semCrc + crc16Pix(semCrc);
}

/** CRC-16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), em 4 hex maiúsculos. */
export function crc16Pix(texto: string): string {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(texto);
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, "0") + valor;
}

/** Sem acento, só ASCII imprimível, em maiúsculas e cortado no limite do campo. */
function textoDoCampo(texto: string, max: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trimEnd();
}
