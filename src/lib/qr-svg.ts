/**
 * QR Code em SVG para o "Me paga um café?" (#121): casca fina sobre o
 * `qrcode-generator`, a lib do design. Importada só quando o modal abre, para
 * não entrar no bundle inicial da home. Correção de erro M, sem margem (a
 * moldura do modal já dá o respiro), módulos em `espresso` e escalável: o SVG
 * ocupa a moldura inteira. Puro: não importa React.
 */
export async function qrSvg(texto: string): Promise<string> {
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  return qr
    .createSvgTag({ cellSize: 4, margin: 0, scalable: true })
    .replace("<svg ", '<svg width="100%" height="100%" aria-hidden="true" ')
    .replace(/fill="black"/g, 'fill="#2C1A0E"');
}
