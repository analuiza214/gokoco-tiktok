# Complementos Kalodata

Cinco produtos adicionais ao kit de pincéis existente. Cada produto tem página
própria nas versões original, TL e Bella Mix, **idênticas ao site original
correspondente** (mesmo mecanismo do upsell do pincel). O kit de pincéis
continua em `/upsell1`; as novas ofertas ficam em `/upsell2` a `/upsell6`.

| Etapa | Produto | Preço | Nota na fonte |
| --- | --- | --- | --- |
| 2 | Popozuda 200g | R$ 79,90 | 4,6/5 |
| 3 | Kit Liso Obrigatório | R$ 95,90 | 4,8/5 |
| 4 | Eudora Ultra Bond Reset | R$ 259,90 | 4,9/5 |
| 5 | Eudora Pro Cronology | R$ 67,99 | 4,7/5 |
| 6 | Principia Essencial Glow | R$ 158,10 | 4,9/5 |

Rotas equivalentes com prefixos `/tl` e `/video`. Cada oferta tem checkout
`/pagamento-{id}` (gerado do `pagamento.html`, igual ao checkout real). A compra
paga e a recusa seguem para a próxima oferta; a última leva a
`/upsell-concluido`.

## Layout (igual ao upsell1)

- `/upsell{2..6}` → `index.html` transformado (TikTok Shop): fotos reais nos
  slots `/images/f2`, vídeos reais nos 4 cards `data-vid` + modal, OPTS com uma
  opção, reviews genéricas nos `<article>`, spec/descricao do catálogo.
- `/tl/upsell{2..6}` → bundle React do `sites/mercado` (`{theme}-{id}-model.js`):
  slides com todas as fotos + 1 slide de vídeo, 4 vídeos na seção de
  depoimentos, BRUSH_COLORS com o conteúdo como variante, reviews/FAQ/specs do
  catálogo, compra → `/tl/pagamento-{id}`.
- `/video/upsell{2..6}` → bundle React do `sites/bella`: produto injetado em
  `lib/data.ts` (posição 0), galeria com as fotos, reviews genéricas, compra →
  `/video/pagamento-{id}`.
- Em todas as páginas há um rodapé de funil (`data-upsell-tail`): "Adicionar"
  para o checkout próprio e "Continuar sem este produto" para a próxima oferta,
  preservando os parâmetros da URL.

## Dados e mídias

- Catálogo compartilhado: `worker-src/upsell-catalog.js`. Preços são os valores
  coletados nas abas fornecidas, não uma política comercial definida.
- Mídias versionadas: `rascunhos-upsell/kalodata/{id}/`, importadas da pasta
  Produtos Kalodata na primeira geração. O build usa a cópia do repo.
- São 29 imagens e 50 vídeos (10 da primeira página de cada produto).
- Avaliações individuais do Kalodata são bloqueadas. **Decisão do Wellington
  (22/10/2026): usar avaliações genéricas** (mesma abordagem do pincel), em
  `GENERIC_REVIEWS` no script. A nota real do produto aparece atribuída à fonte
  nas tabelas de especificações.
- `scripts/build-kalodata-upsells.mjs` monta o `productConfig(p)` (mesma forma
  do `PRODUCT` do pincel) e chama os builders `buildOriginal`/`bundleVariant` de
  `build-upsell.mjs`, agora parametrizados por produto.

## Vitrine

`/vitrine`, `/tl/vitrine` e `/video/vitrine` mostram os cinco produtos com
imagem principal, preço, busca por nome e filtros por categoria. É uma página
funcional sem equivalente nos sites originais — layout próprio
(`kalodata.css`/`storefront.css`). Cards levam ao upsell correspondente da
mesma versão da loja.

## Geração e validação

`scripts/build-kalodata-upsells.mjs` roda ao final de `build-upsell.mjs`.

```sh
node build-worker.mjs
node scripts/prepare-deploy.mjs
node tests/multisite.mjs
node tests/upsell-catalog.mjs
```

Prévia local (roteamento upsell replicado sobre `dist/`):

```sh
node scripts/preview-server.mjs 8787
# http://localhost:8787/upsell2 · /tl/upsell2 · /video/upsell2 · /vitrine
```

Os testes verificam rotas, métodos, sequência, preços do backend, presença das
mídias, assinatura MP4 e sintaxe dos scripts. Não criam pedidos ou cobranças.
