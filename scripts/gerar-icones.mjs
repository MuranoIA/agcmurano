/**
 * Gera os PNGs do PWA a partir dos SVGs em public/.
 *
 * Os PNGs são versionados no repo — este script só é necessário quando o
 * desenho do ícone mudar. Precisa do sharp, que não é dependência do projeto:
 *
 *   npm i --no-save sharp && node scripts/gerar-icones.mjs
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";

const saidas = [
  { svg: "public/icon-512.svg", png: "public/icon-512.png", tamanho: 512 },
  { svg: "public/icon-512.svg", png: "public/icon-192.png", tamanho: 192 },
  { svg: "public/icon-maskable.svg", png: "public/icon-512-maskable.png", tamanho: 512 },
  { svg: "public/icon-maskable.svg", png: "public/icon-192-maskable.png", tamanho: 192 },
  { svg: "public/icon-apple.svg", png: "public/apple-touch-icon.png", tamanho: 180 },
];

for (const { svg, png, tamanho } of saidas) {
  await sharp(readFileSync(svg), { density: 384 })
    .resize(tamanho, tamanho)
    .png({ compressionLevel: 9 })
    .toFile(png);
  console.log(`${png} (${tamanho}x${tamanho})`);
}
