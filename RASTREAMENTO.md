# Compras confirmadas — Bella Mix / GOKOCO

A confirmação continua sendo consultada no gateway. Depois de confirmar, o servidor envia a compra; a página do cliente não precisa continuar aberta. A consulta do checkout, o webhook e a atualização do admin passam pelo mesmo controle de envio no campo `tracking` existente em `gokoco_orders`. Não é necessário executar SQL novo.

## Configuração no Cloudflare Pages

Projeto: `gokoco-tiktok`. Em Settings → Variables and Secrets → Production, cadastre:

| Nome | Valor / finalidade |
| --- | --- |
| `UTMIFY_API_TOKEN` | Secret: credencial em UTMify → Integrações → Webhooks → Credenciais de API. Não é o ID `6ac04e3b1a55004cc989a15d`. |
| `PURCHASE_DELIVERY_MODE` | `utmify` para usar o fluxo de pedidos da loja Top Mix. |
| `SITE_URL` | `https://gokoco-tiktok.pages.dev` ou o domínio definitivo da loja. |

Na UTMify, confira se o pixel `1542362403143695` está vinculado à conta e configurado para receber eventos de compra. A aceitação do pedido pela API da UTMify comprova o envio à UTMify; o recebimento pela Meta precisa ser conferido no Gerenciador de Eventos e depende da configuração da conta UTMify.

Após mudar os secrets, faça um novo deployment/retry do deployment no Pages para a versão ativa receber os valores. Os scripts públicos não devem conter credenciais privadas.

## Alternativa: Meta diretamente

Use `PURCHASE_DELIVERY_MODE=meta`, `FB_PIXEL_ID=1542362403143695` e o secret `FB_ACCESS_TOKEN` gerado para a API de Conversões desse pixel. `FB_API_VERSION` tem padrão `v25.0`. `FB_TEST_EVENT_CODE` é opcional para verificar eventos de teste e deve ser removido depois.

O modo `meta` envia à Meta diretamente; o modo `utmify` envia somente à UTMify. Sem modo explícito, a presença de `UTMIFY_API_TOKEN` dá preferência à UTMify; se ela não estiver configurada e existir `FB_ACCESS_TOKEN`, usa Meta. Isso evita enviar a mesma compra por duas integrações de servidor independentes.

No modo Meta, o Purchase do navegador e do servidor compartilham `pix_<id interno do pedido>` para deduplicação. No modo UTMify, o Purchase manual do navegador fica desativado porque a identificação de evento da UTMify é própria. PageView e o InitiateCheckout ao avançar dos dados para o CEP continuam no navegador. ViewContent é enviado na página do produto.

O script automático `scripts/pixel/pixel.js` enviado na conversa permanece fora da publicação: ele reconhece botões de compra e links de pagamento como início de checkout, contrariando a regra solicitada para a etapa de CEP. O script de UTMs `scripts/utms/latest.js` continua instalado.

## Recuperação e diagnóstico

O admin mostra, junto do pedido pago, se a compra foi enviada, aguarda configuração ou falhou. O envio só é marcado como concluído após uma resposta aceita do destino; a falha mantém o pedido pago e permite tentar de novo. Reservas de envio têm prazo de dois minutos, com espera de um minuto após falha.

Na abertura/atualização do admin, até dois pagamentos pendentes são verificados por vez. A fila usa a última atualização como posição e reserva cada tentativa antes de consultar o gateway, para que erros e pendências voltem ao fim da fila e não bloqueiem pedidos seguintes.

Ao atualizar o admin, são recuperados até três envios de compras pagos nos últimos sete dias ainda sem confirmação do destino e até três códigos de rastreio ausentes. O admin atualiza a lista automaticamente a cada 60 segundos enquanto está aberto; cada atualização confere até dois pagamentos pendentes, em ordem rotativa, junto com a leitura dos pedidos. Também existem tentativas no webhook e na consulta de status do PIX. Os pedidos antigos sem UTMs salvas não ganham uma atribuição retroativa inventada. Se não houver data registrada pelo gateway no histórico, a recuperação usa a data em que o pedido foi marcado pago no banco.

Não é necessário manter um Worker Cron separado para essa rotina. Se o painel estiver fechado e o gateway não enviar webhook, a conferência de pagamentos pendentes volta a ocorrer quando o admin for aberto ou atualizado; não há consulta contínua do servidor em segundo plano.

Webhook: `https://gokoco-tiktok.pages.dev/api/pix/webhook`. Na Venus Pay, ele precisa estar cadastrado no painel do gateway. Nos gateways que aceitam callback na cobrança, a configuração usa `SITE_URL`. O webhook reconhece IDs nos formatos planos e aninhados mais comuns, verifica a transação consultando a API do gateway e registra aviso no log quando não encontra um pedido. Se um gateway não enviar webhook, o admin continua verificando a fila ao ser aberto/atualizado.

Se o pedido foi aceito pelo destino, mas o processo caiu antes de registrar o sucesso, a tentativa pode se repetir. A UTMify recebe sempre o mesmo `orderId`; a Meta recebe sempre o mesmo `event_id` e data do evento. O controle local impede envios simultâneos, mas não promete execução exatamente uma vez entre serviços externos.

## Verificação

Faça um pedido de teste real e confira separadamente: confirmação no gateway, pedido pago no admin, status de envio no admin e recebimento na UTMify/Meta. Gerar o PIX sozinho não envia Purchase. Não há endpoint público que aceite um valor informado pelo navegador como compra aprovada.

Testes locais: `node --test scripts/purchase-tracking.test.mjs scripts/purchase-routes.test.mjs` após `npm run build`.
