# Carregamento das lojas

## Otimizações

- O build gera imagens WebP responsivas em `dist/_responsive`, com larguras de até 192, 480 e 960 pixels. Os originais continuam intactos e acessíveis. Se a conversão ficar maior que o original, o original é reutilizado.
- O HTML publicado recebe `srcset` e `sizes` nas imagens locais de páginas estáticas e upsells. Miniaturas recebem tamanhos compatíveis com a exibição. O preload usa o mesmo conjunto da imagem principal.
- Imagens com ID, imagens de produto substituídas pelo checkout, imagens externas, animadas e imagens que já possuem `srcset` não são reescritas.
- A página inicial prioriza a primeira imagem. As demais imagens do carrossel usam carregamento sob demanda e prioridade baixa, sem preloads concorrentes.
- A tag local de Google Ads da página inicial usa `defer`; eventos, identificadores e atribuição permanecem iguais. A captura inicial de UTMs continua síncrona.
- Na loja `/tl/`, as etapas internas são carregadas por rota, usando `React.lazy`. A página de entrada permanece no bundle inicial. O carrossel prioriza a primeira imagem e reserva suas dimensões.

As rotas, valores, gateways, autenticação, banco, webhooks e regras comerciais não foram alterados. Os players e tags de marketing continuam disponíveis. Não foram removidos scripts apenas por aparecerem como parcialmente não utilizados no Lighthouse.

## Validação

- `npm run build`
- `node tests/performance-assets.mjs`: imagens geradas válidas, arquivos originais preservados, preload coerente e imagens dinâmicas protegidas.
- Todos os testes em `tests/*.mjs`, incluindo multisite, upsells, gateways e Verdefy.
- `npm run typecheck --prefix sites/mercado`
- `npx wrangler deploy --dry-run --config wrangler.jsonc`
- Conferência em navegador isolado: layout inicial, imagens, carrossel, seleção de cor/voltagem, UTMs, checkout, lojas e upsells. Nenhuma cobrança real foi criada.

Para comparar desempenho, usar o mesmo perfil Lighthouse em cada execução: mobile, rede simulada com RTT de 150 ms e throughput de 1.638,4 Kbit/s, CPU 6× mais lenta, navegador sem cache reutilizado. Usar medianas de três execuções. Não comparar diretamente a prévia local (sem latência real e com diferenças de origem no rastreamento) com produção.

O código é publicado por Workers Builds após push na `main`. Os derivados são gerados no build e não precisam ser commitados. Para desenvolver com `wrangler dev`, concluir a geração dos assets antes de iniciar o servidor; se a pasta `dist` for recriada, reiniciar a prévia para atualizar seu inventário de arquivos.
