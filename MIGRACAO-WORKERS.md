# Migração do gokoco-tiktok para Cloudflare Workers

Data: 07/11/2026.

## Publicação
- Worker: gokoco-tiktok.
- URL: https://gokoco-tiktok.loja-oficial.workers.dev
- Versão publicada: 01027e75-3f94-4d3b-a90c-725650f77f5c.
- Três lojas, APIs e assets publicados juntos; binding ASSETS e run_worker_first habilitados.
- Namespace pix-ratelimit existente vinculado como PIX_RATELIMIT, com autorização do proprietário.
- Logs e traces habilitados.
- Pages preservado como fallback. A API não lista domínios personalizados ligados a esse Pages. Nenhum domínio foi transferido.
- Reconciler em produção permanece intacto até a configuração dos secrets no novo Worker.

## Validação
| Verificação | Resultado |
| --- | --- |
| npm run build | PASSOU |
| node tests/invictuspay.mjs | PASSOU, API simulada |
| node tests/unipay.mjs | PASSOU, API simulada |
| node tests/multisite.mjs | PASSOU |
| node tests/verdefy.mjs | PASSOU, 5 testes |
| wrangler deploy --dry-run --config wrangler.jsonc | PASSOU |
| wrangler deploy --dry-run --config reconciler/wrangler.jsonc | PASSOU |
| GET / | 200 HTML |
| GET /pagamento.html | 200 HTML após redirecionamento para /pagamento |
| GET /video/ | 200 HTML |
| GET /tl/ | 200 HTML |
| POST /api/public/pix/create com {} | 400 JSON |
| GET /api/admin/orders sem autenticação | 401 JSON |
| GET /api/xyz | 404 JSON |
| GET /_worker.js | 404, bundle não exposto como asset |
| PIX real e recebimento de webhook | PENDENTE: secrets do Worker |

Resultados HTTP completos: workers-validation.json.
O build terminou com avisos preexistentes de dependências e scripts Vite; nenhum erro de build.

## Arquivos alterados
- wrangler.jsonc: Worker principal, assets, KV, observabilidade e variáveis recuperáveis; SITE_URL/BELLA_SITE_URL apontam para o novo Worker.
- worker-src/index.js: somente fallbacks de domínio, derivados de SITE_URL/BELLA_SITE_URL ou request.url; request encaminhado às funções auxiliares.
- _worker.js: bundle regenerado.
- scripts/prepare-deploy.mjs: gera dist/.assetsignore para excluir _worker.js da publicação estática.
- .github/workflows/pages-deployment.yml: publicação principal alterada para wrangler deploy; npm ci, npm run build, secrets do Actions e step do reconciler mantidos.
- reconciler/worker.js: URL-base passa a usar env.SITE_URL; lógica de reconciliação preservada.
- reconciler/wrangler.jsonc: SITE_URL configurado para o novo Worker. Ainda não publicado.
- package.json e package-lock.json: Wrangler 4.158.0 instalado como dependência de desenvolvimento.
- scripts/setup-secrets.sh: comandos interativos de secrets na ordem solicitada, acrescidos de nomes encontrados no projeto e no Pages.
- scripts/setup-secrets.ps1: equivalente para PowerShell.
- LEIA-ME.md, INVICTUSPAY.md, MULTISITE.md, RASTREAMENTO.md e rascunhos-upsell/PLANO.md: documentação atualizada para Workers e nova URL.
- MIGRACAO-WORKERS.md e workers-validation.json: relatório e resultados.
Nenhuma alteração foi enviada ao GitHub. O workflow remoto ainda precisa receber estas mudanças, após os secrets estarem prontos para evitar ativação prematura do reconciler.

## Variáveis
Copiadas do Pages: ADMIN_EMAIL, CF_ACCESS_AUD e CF_ACCESS_TEAM_DOMAIN.
SITE_URL e BELLA_SITE_URL foram definidos para o endereço novo.
O Pages retorna somente os nomes dos secrets, sem valores; não é possível copiá-los automaticamente.
Secrets existentes no Pages que ainda precisam ser configurados no Worker (os utilizados pela operação atual):
- ADMIN_PASS
- ADMIN_SESSION_SECRET
- ADMIN_USER
- CRON_SECRET
- FB_ACCESS_TOKEN
- FLEVOPAY_API_KEY
- INVICTUSPAY_API_KEY
- IRONPAY_API_TOKEN
- IRONPAY_OFFER_HASH
- IRONPAY_PRODUCT_HASH
- MASTERFY_API_KEY
- MASTERFY_TOKENIZATION_KEY
- RESEND_API_KEY
- RESEND_FROM_EMAIL
- RESHIPPING_FEE_AMOUNT
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL
- UMBRELLAPAG_API_KEY
- UNIPAY_PUBLIC_KEY
- UNIPAY_SECRET_KEY
- UTMIFY_API_TOKEN
- VENUS_PAY_PUBLIC
- VENUS_PAY_SECRET_KEY
- VERDEFY_SALES_SOURCE
- VERDEFY_SALES_TOKEN
- VITE_ENCRYPT_KEY

Outros nomes previstos no código/roteiro, configurar apenas quando utilizados:
ENCRYPT_KEY, BELLA_ENCRYPT_KEY, BELLA_VITE_ENCRYPT_KEY, FLEVOPAY_PRODUCT_HASH, VENUS_PAY_PRODUCT_ID.
Variáveis comuns opcionais ausentes no Pages:
SITE_VARIANT, BELLA_HOSTNAME, MARKET_HOSTNAME, FB_PIXEL_ID, FB_API_VERSION, FB_TEST_EVENT_CODE,
GATEWAY_MASK_CUSTOMER, GATEWAY_MASK_EMAIL_DOMAIN, GATEWAY_MASK_PHONE, PURCHASE_DELIVERY_MODE,
PURCHASE_MIGRATION_AT. Não foram inventados valores para elas.

ADMIN_USER, SUPABASE_URL, RESEND_FROM_EMAIL e RESHIPPING_FEE_AMOUNT estão criptografados no Pages.
Podem ser recolocados como variáveis comuns, mas seus valores também não são recuperáveis.
Manter o mesmo VITE_ENCRYPT_KEY usado anteriormente para ler dados já criptografados.

## Conclusão pendente
1. Inserir no Worker os valores secretos existentes no Pages, diretamente no painel Cloudflare ou nos prompts dos scripts (nunca no chat/código).
2. Validar login, acesso ao Supabase e o gateway ativo.
3. Gerar PIX de teste real e verificar recebimento do postback no log.
4. Publicar o ajuste do reconciler somente após o Worker ter o mesmo CRON_SECRET e as integrações prontas.
5. Enviar as alterações ao GitHub para concluir a mudança do CI.
6. Confirmar com o proprietário os domínios pretendidos antes de anexá-los. O endereço pages.dev não pode ser transformado em workers.dev; o Worker já possui sua URL própria.


## Atualização para loja-oficial

Worker republicado com SITE_URL e BELLA_SITE_URL em loja-oficial.workers.dev.
Verdefy: URL de tracker.js e /v1/sales atualizadas. Build, testes multisite e os 5 testes Verdefy passaram.
Versão: e103dcb4-ada8-4594-aef7-2babd4f3d3c3.
Reconciler: configuração local atualizada; publicação continua pendente dos secrets.
Verificação HTTP nesta atualização: [{"url":"https://gokoco-tiktok.loja-oficial.workers.dev/","status":200},{"url":"https://verdefy-sales.loja-oficial.workers.dev/tracker.js","status":404}]
