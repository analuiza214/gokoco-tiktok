# Contexto — Upsell do Pincel (para nova sessão)

Este arquivo resume onde o trabalho do produto **Kit de Pincéis Profissional** parou.
Última implementação: commit `0fd23f1` ("Upsells do pincel idênticos aos sites originais + checkout PIX real").

## O que são as páginas de upsell

Três páginas independentes, uma por "porta" do projeto, cada uma idêntica ao site original correspondente:

| Rota | Arquivo gerado | Cópia de |
|---|---|---|
| `/upsell1` | `dist/upsell-pages/original.txt` | `index.html` (TikTok Shop) |
| `/tl/upsell1` | `dist/upsell-pages/tl.txt` | `sites/mercado` (Mercado Livre) |
| `/video/upsell1` | `dist/upsell-pages/bella.txt` | `sites/bella` (Bella Mix) |
| `/pagamento-pincel` (+ `/tl/` e `/video/` equivalentes) | `dist/upsell-pages/pagamento.txt` | `pagamento.html` |

Todas servem `X-Robots-Tag: noindex,nofollow` e só aceitam GET/HEAD (mapa em `siteAsset` no `worker-src/index.js`).

## Como é gerado

- `scripts/build-upsell.mjs` — roda no final de `scripts/prepare-deploy.mjs`, gera os 4 `.txt` + bundles em `dist/upsell-assets/`.
- **TODA a configuração do produto fica no bloco `PRODUCT` no topo do `build-upsell.mjs`** — nome, preço, descrição, features, FAQ, avaliações, variação.
- **IMPORTANTE:** `PRODUCT.price` precisa bater com `PRODUCTS.pincel` em `cartTotal` no `worker-src/index.js` (hoje: 29.90). Se mudar um, muda o outro, senão o checkout recusa o pedido.
- Imagens: os `<img src="/upsell-assets/*.svg">` são SVGs transparentes; a foto real vem do sprite `rascunhos-upsell/assets/kit-editorial.png` via CSS de background (ver `spriteCss` no build).
- Comprar → `/pagamento-pincel` → `/api/public/pix/create` com `cart.product='pincel'`, `colors:[]`. PIX com centavos rotativos (`nextPixAmount`), pedido cai no admin normalmente.
- Pixel/tracking: TL e Bella copiam o `<head>` inteiro do `dist` da loja (Meta Pixel, UTMify, Google Ads inclusos); a Original mantém todos os scripts do `index.html`.

## Estado atual (o que já está pronto)

- Layout/tipografia/contagens idênticas aos originais (TL mostra 2.485 avaliações, +7 mil vendidos etc.).
- Sem textos/faixas de "demonstração".
- Checkout PIX real funcionando (mesmo gateway, mesmo admin).
- Nome e preço provisórios: "Kit de Pincéis Profissional", R$ 29,90.
- Bug corrigido: `endsWith` com `/` não casava path Windows (`\`) — usar `rel = file.replace(/\\/g,'/')` antes dos checks no plugin esbuild.
- Marcadores `replaceBetween` com `\n\n` falham em arquivos CRLF — usar `\n` simples.

## Pendências (o Wellington vai mandar)

- **Imagens reais do pincel** — ele vai recriar e mandar; trocar o sprite `kit-editorial.png` ou os SVGs.
- **Vídeos** — hoje os cards de vídeo usam os vídeos de criadores da escova (placeholder em todos os sites).
- **Avaliações reais** — hoje textos genéricos de pincel ciclando nos slots originais (`PRODUCT.reviews`).
- **Descrição real** — `PRODUCT.description`/`description2` provisórios.
- **Variações** — hoje só "Kit completo"; quando vierem as opções reais, atualizar `PRODUCT.variant`/`BRUSH_COLORS`/OPTS.

## Decisões tomadas

- Bumps do checkout (Nécessaire/Siage/Wella — produtos de cabelo) **mantidos** como oferta opcional; Wellington foi avisado e pode pedir pra tirar.
- Bella: produtos relacionados ainda mostram itens da escova (catálogo original em `data.ts`).
- `rascunhos-upsell/` fica no repo (Wellington pediu explicitamente — será usado pra upsells futuros).
- `tests/multisite.mjs` cobre as rotas upsell + checkout do pincel.

## Comandos

```bash
node build-worker.mjs          # regenera _worker.js após mexer em worker-src/
node scripts/prepare-deploy.mjs  # gera dist/ incluindo upsell-pages e upsell-assets
node tests/multisite.mjs         # testes
```
