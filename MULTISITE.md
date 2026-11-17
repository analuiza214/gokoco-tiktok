# GOKOCO, Bella Mix e loja da escova

Este projeto publica três visuais em um único Cloudflare Workers com um único `_worker.js`:

- `/`: site e admin GOKOCO;
- `/video/`: catálogo completo e checkout Bella Mix;
- `/tl/`: página Kit 3 em 1 no visual Mercado Livre.

O admin GOKOCO em `/admin.html` contém a seção **Bella Mix**, que lista pedidos, permite salvar rastreios e configurar os gateways do catálogo. A loja Mercado Livre grava seus pedidos diretamente em `gokoco_orders`, junto com os pedidos do visual GOKOCO. O catálogo Bella Mix continua usando a tabela `leads` e seus fluxos de PIX e cartão, mas as rotas são executadas no mesmo Worker e os pedidos são consultados no admin GOKOCO.

## Publicação

1. Executar `npm run build` e publicar com `npx wrangler deploy --config wrangler.jsonc`; `dist` contém os assets e o Worker.
2. O domínio atual atende os três visuais. `SITE_URL` permanece com a URL completa do GOKOCO. Os links de rastreio da Bella Mix usam `SITE_URL` + `/video` automaticamente (ou `BELLA_SITE_URL`, se configurada para um domínio próprio).
4. Manter as variáveis atuais, incluindo `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_SESSION_SECRET` e as credenciais do gateway ativo — todas compartilhadas entre os visuais, já que é um único backend.
5. Para salvar e visualizar cartões da Bella Mix no admin, configurar `ENCRYPT_KEY` no Cloudflare (a antiga `VITE_ENCRYPT_KEY` também é aceita). Variáveis com prefixo `BELLA_` não são mais necessárias: caso existam, funcionam apenas como sobrescrita opcional por rota. As variáveis de build `VITE_GTM_ID`, `VITE_GA_ID`, `VITE_UTMIFY_PIXEL_ID` e `VITE_SUPPORT_EMAIL` seguem como secrets do GitHub, conforme configuradas. O WhatsApp de suporte é fixo no código (`fale-conosco.tsx` e nos links `wa.me`), sem variável.
6. Atualizar a URL de webhook PIX dos gateways usados pela Bella Mix para `https://gokoco-tiktok.loja-oficial.workers.dev/video/api/pix/webhook`. O webhook do GOKOCO continua em `/api/pix/webhook`.
7. Validar em homologação um pedido PIX de cada visual, um pedido de cartão Bella Mix, atualização de status e visualização dos pedidos no admin antes de trocar os domínios de produção.

Os domínios ainda precisam ser informados e as variáveis do banco Bella Mix precisam ser configuradas na publicação. Nenhuma credencial é gravada neste repositório.

## Desenvolvimento

`sites/bella` e `sites/mercado` contêm cópias dos frontends originais. Alterações futuras nos visuais devem ser feitas nessas pastas para entrar no build unificado. `sites/bella/functions` preserva as rotas legadas do checkout Bella Mix, importadas pelo Worker central. Os arquivos estáticos são publicados em `/video` e `/tl`, sem carregar os assets dos três visuais em uma visita a apenas um deles.

Rode `npm run build` e `npm run test:multisite` para conferir o empacotamento e o roteamento por caminho.


## Forja Ferramentas integrada ao painel central

A cópia integrada fica em `sites/forja`, preservando a pasta original fornecida pelo usuário. Publicação pelo mesmo Worker, em `/forja/`; produto principal: Kit Ferramentas 4 em 1, R$ 67,90. O catálogo completo tem 19 produtos, com preços e identificação validados no servidor em `worker-src/forja-catalog.js`.

O seletor **Produtos**, no topo do admin, permite ver todos, GOKOCO/Bella Mix, toda a Forja ou cada produto Forja. Resumos, pedidos e filtros de taxas respeitam a seleção. A configuração de gateways continua global, fora do filtro de produto.

Pedidos Forja usam `gokoco_orders`, com `tracking.store_id=forja`, `tracking.site_variant=forja` e `tracking.product_id` correspondente ao catálogo. Não é necessário criar banco ou login adicional nem migrar tabelas para essa identificação. Pedidos históricos continuam com sua classificação anterior.

O Pix da Forja entra em `/forja/api/public/pix/create`; a confirmação chega ao webhook central `/api/pix/webhook`. A seleção do gateway afeta novas cobranças; pagamentos existentes conservam o gateway original. E-mail, reconciliação e rastreio usam os mesmos serviços centrais; as mensagens e os links de pedidos Forja recebem a identidade Forja. O valor da Forja é o total validado do catálogo, sem a variação de centavos existente na escova.

O build adapta links, arquivos e chaves do carrinho para `/forja`. Após pagar, a página volta à vitrine Forja, pois não existe uma oferta de upsell Forja cadastrada. O catálogo e as páginas em `sites/forja` são a fonte para futuras alterações, sem dependência do caminho externo no computador.

Credenciais de conta são compartilhadas. Gateways que exigem identificação específica de oferta/produto (por exemplo, hashes da IronPay) precisam dessa identificação conferida para a Forja antes de operar; compartilhar a conta não garante que um código de oferta da escova represente o kit.

Validação local: `node build-worker.mjs`, `node scripts/prepare-deploy.mjs`, `npm run test:forja`, `npm run test:multisite` e testes de pagamento/e-mail em `scripts`. Os testes usam respostas simuladas e não geram Pix real. A validação de produção ainda precisa conferir credenciais, estado real do banco, geração de Pix, confirmação do pagamento e exibição no filtro Forja. Nenhuma publicação foi executada nesta integração local.


## Edição de preços e descontos

O botão **Preços e descontos** abre o cadastro de preços por produto. O operador informa preço original e preço de venda; o percentual principal é calculado automaticamente. Pix e recuperação são percentuais adicionais independentes (0% desativa o desconto respectivo). A prévia mostra venda, Pix e Pix com recuperação antes de frete e complementos.

A escova 3 em 1 usa a mesma configuração em GOKOCO, TL e nas cores equivalentes Bella Mix. O kit 7 em 1 Bella Mix tem configuração própria compartilhada entre suas cores. Cada produto Forja e cada complemento/upsell possui sua configuração. Alterar um produto não altera os demais.

### Ativação no ambiente publicado

1. Executar `supabase/gokoco_product_prices.sql` no mesmo Supabase usado pelo painel. A tabela tem RLS e não libera acesso direto a visitantes.
2. Publicar o build atualizado do Worker e dos sites. A integração local não executou alterações no banco de produção.
3. Abrir o admin, escolher o produto em **Preços e descontos**, conferir os quatro campos e salvar. Até o primeiro salvamento, cada visual preserva seus preços anteriores.
4. Conferir o produto nas vitrines e páginas correspondentes, carrinho e checkout; gerar uma cobrança de teste somente após essa conferência.

Sem a tabela, a loja preserva os preços anteriores e o painel informa que o salvamento ainda não está ativado. Uma falha inesperada ao consultar o banco não usa valores antigos silenciosamente. Edições concorrentes são rejeitadas até que o operador atualize a configuração.

As páginas HTML recebem a configuração atual do servidor, com cache desativado. Os aplicativos Bella Mix e TL recebem a mesma configuração antes de renderizar, e carrinhos persistidos são recalculados com o catálogo atual. Páginas deixadas abertas verificam alterações ao recuperar o foco. O servidor valida novamente antes de criar a cobrança; divergências de preço exigem atualização da página.

Pedidos e cobranças já criados mantêm o valor salvo. Novos pedidos registram a configuração de preço utilizada no histórico do pedido. Após salvar um preço no painel, o valor cobrado desse produto não recebe a antiga variação de 1 a 5 centavos. O desconto de recuperação é aplicado somente nos fluxos que já oferecem recuperação; esta alteração não cria uma oferta nova onde ela não existe.

Checks: `npm run test:prices`, `npm run test:forja`, `npm run test:multisite`, build dos dois aplicativos e compilação do Worker.
