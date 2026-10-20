# GOKOCO, Bella Mix e loja da escova

Este projeto publica três visuais em um único Cloudflare Pages com um único `_worker.js`:

- `/`: site e admin GOKOCO;
- `/video/`: catálogo completo e checkout Bella Mix;
- `/tl/`: página Kit 3 em 1 no visual Mercado Livre.

O admin GOKOCO em `/admin.html` contém a seção **Bella Mix**, que lista pedidos, permite salvar rastreios e configurar os gateways do catálogo. A loja Mercado Livre grava seus pedidos diretamente em `gokoco_orders`, junto com os pedidos do visual GOKOCO. O catálogo Bella Mix continua usando a tabela `leads` e seus fluxos de PIX e cartão, mas as rotas são executadas no mesmo Worker e os pedidos são consultados no admin GOKOCO.

## Publicação

1. Configurar o build de Pages como `npm run build`, com saída `dist`.
2. O domínio atual atende os três visuais. `SITE_URL` permanece com a URL completa do GOKOCO. Os links de rastreio da Bella Mix usam `SITE_URL` + `/video` automaticamente (ou `BELLA_SITE_URL`, se configurada para um domínio próprio).
4. Manter as variáveis atuais, incluindo `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_SESSION_SECRET` e as credenciais do gateway ativo — todas compartilhadas entre os visuais, já que é um único backend.
5. Para salvar e visualizar cartões da Bella Mix no admin, configurar `ENCRYPT_KEY` no Cloudflare (a antiga `VITE_ENCRYPT_KEY` também é aceita). Variáveis com prefixo `BELLA_` não são mais necessárias: caso existam, funcionam apenas como sobrescrita opcional por rota. As variáveis de build `VITE_GTM_ID`, `VITE_GA_ID`, `VITE_UTMIFY_PIXEL_ID`, `VITE_SUPPORT_WHATSAPP` e `VITE_SUPPORT_EMAIL` seguem como secrets do GitHub, conforme configuradas.
6. Atualizar a URL de webhook PIX dos gateways usados pela Bella Mix para `https://gokoco-tiktok.pages.dev/video/api/pix/webhook`. O webhook do GOKOCO continua em `/api/pix/webhook`.
7. Validar em homologação um pedido PIX de cada visual, um pedido de cartão Bella Mix, atualização de status e visualização dos pedidos no admin antes de trocar os domínios de produção.

Os domínios ainda precisam ser informados e as variáveis do banco Bella Mix precisam ser configuradas na publicação. Nenhuma credencial é gravada neste repositório.

## Desenvolvimento

`sites/bella` e `sites/mercado` contêm cópias dos frontends originais. Alterações futuras nos visuais devem ser feitas nessas pastas para entrar no build unificado. `sites/bella/functions` preserva as rotas legadas do checkout Bella Mix, importadas pelo Worker central. Os arquivos estáticos são publicados em `/video` e `/tl`, sem carregar os assets dos três visuais em uma visita a apenas um deles.

Rode `npm run build` e `npm run test:multisite` para conferir o empacotamento e o roteamento por caminho.
