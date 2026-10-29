# InvictusPay PIX

Integração no painel central, checkout GOKOCO e /tl, checkout /video, consulta de status, reconciliação e taxa de reenvio.

Documentação oficial consultada em 28/10/2026:
- https://app.invictuspayv2.com.br/docs/transacoes
- https://app.invictuspayv2.com.br/docs/webhooks
- https://app.invictuspayv2.com.br/docs/autenticacao

## Ativação pendente

1. Executar `supabase/gokoco_invictuspay_migration.sql` no Supabase usado pela loja. O registro inicia desativado.
2. Configurar `INVICTUSPAY_API_KEY` como secret de servidor no Cloudflare Pages e no reconciliador. Nunca usar prefixo VITE nem salvar a chave no código.
3. Validar o JSON real de criação e consulta no ambiente da InvictusPay. A documentação pública descreve a requisição, mas não exemplifica a resposta de criação. O adaptador aceita envelopes comuns e recusa respostas incompletas. Esses formatos ainda não foram confirmados em cobrança real.
4. Publicar o Worker e selecionar InvictusPay no painel somente após validar criação, pagamento, confirmação e expiração.

O postback é enviado automaticamente por cobrança via HTTPS. O webhook consulta a API privada antes de reconhecer pagamento. Não há confirmação de pagamento baseada somente no conteúdo recebido.

Validação local: `node tests/invictuspay.mjs` (API simulada) e `node build-worker.mjs`.

Nenhuma chave foi gravada, cobrança real criada ou configuração de produção alterada durante a implementação.
