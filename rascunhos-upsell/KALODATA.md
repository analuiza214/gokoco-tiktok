# Complementos Kalodata

Cinco produtos adicionais ao kit de pincéis existente. Cada produto tem página
própria nas versões original, TL e Bella Mix. O kit de pincéis continua em
`/upsell1`; as novas ofertas ficam em `/upsell2` a `/upsell6`.

| Etapa | Produto | Preço | Nota na fonte |
| --- | --- | --- | --- |
| 2 | Popozuda 200g | R$ 79,90 | 4,6/5 |
| 3 | Kit Liso Obrigatório | R$ 95,90 | 4,8/5 |
| 4 | Eudora Ultra Bond Reset | R$ 259,90 | 4,9/5 |
| 5 | Eudora Pro Cronology | R$ 67,99 | 4,7/5 |
| 6 | Principia Essencial Glow | R$ 158,10 | 4,9/5 |

Rotas equivalentes com prefixos `/tl` e `/video`. Cada oferta tem checkout
`/pagamento-{id}`. A compra paga e a recusa seguem para a próxima oferta;
a última leva a `/upsell-concluido`. Os checkouts mantêm a versão da loja.

## Dados e mídias

- Catálogo compartilhado: `worker-src/upsell-catalog.js`. Preços iniciais são os
  valores coletados nas abas fornecidas, não uma política comercial definida.
- Mídias versionáveis: `rascunhos-upsell/kalodata/{id}/`, importadas da pasta
  Produtos Kalodata na primeira geração. O build seguinte usa a cópia do repo.
- São 29 imagens e 50 vídeos (10 da primeira página de cada produto).
- Vídeos podem incluir publicidade; não são classificados como avaliações
  verificadas de compradores.
- As avaliações individuais estavam bloqueadas. As páginas mostram somente
  a nota geral com atribuição ao Kalodata e data da coleta, sem depoimentos
  inventados ou contagens de avaliações da escova.

## Geração e validação

`scripts/build-kalodata-upsells.mjs` roda ao final de `build-upsell.mjs`.
As páginas seguem em `dist/upsell-pages` e as mídias em
`dist/upsell-assets/kalodata`. Os assets públicos não dependem de URLs assinadas
ou dos arquivos da pasta Downloads.

Com os builds existentes das lojas disponíveis:

```sh
node build-worker.mjs
node scripts/prepare-deploy.mjs
node tests/multisite.mjs
node tests/upsell-catalog.mjs
```

Os testes verificam rotas, métodos, sequência, preços do backend, presença das
mídias, assinatura MP4 e sintaxe dos scripts. Não criam pedidos ou cobranças.
A prévia no Chrome falhou por conexão local; revisão visual ficou pendente.
Nenhuma publicação foi executada nesta alteração.

## Vitrine

`/vitrine`, `/tl/vitrine` e `/video/vitrine` mostram os cinco produtos coletados,
com imagem principal, preço, conteúdo, busca por nome e filtros por categoria.
Cada card leva ao upsell correspondente (2 a 6) da mesma versão da loja.
Os parâmetros da URL acompanham os links dos produtos. Nas páginas dos novos
produtos, o cabeçalho oferece retorno à vitrine.

O template fica em `scripts/storefront.mjs`; os estilos ficam em
`rascunhos-upsell/assets/storefront.css`. A geração faz parte do mesmo build.
Os testes também executam o controlador de filtros, busca, estado vazio e
preservação dos parâmetros, sem dependência de rede.
