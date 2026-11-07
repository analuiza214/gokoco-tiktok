# GOKOCO TikTok

Projeto versionado no GitHub e publicado automaticamente no Cloudflare Workers.

- Site: https://gokoco-tiktok.loja-oficial.workers.dev/
- Admin: https://gokoco-tiktok.loja-oficial.workers.dev/admin
- Cloudflare Workers: `gokoco-tiktok`
- Tabelas exclusivas do Supabase: `gokoco_orders` e `gokoco_gateways`

## Publicação automática

O workflow `.github/workflows/pages-deployment.yml` publica a branch `main` no Worker sempre que recebe uma atualização. O build gera `_worker.js` a partir de `worker-src/` e prepara os arquivos públicos em `dist/`.

O repositório precisa ter os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`, usados somente pelo GitHub Actions para publicar no Cloudflare.

As variáveis do site (Supabase e acesso administrativo) e as chaves privadas dos gateways permanecem em Cloudflare Workers > Settings > Variables and Secrets. Não coloque esses segredos no GitHub, no código ou no pacote público.

As chaves de gateway ainda serão fornecidas pelo proprietário. Até uma chave estar configurada e o gateway ativado em `/admin`, o checkout não gera PIX.
