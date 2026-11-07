# Tracking — etapa1 — 07/11/2026

Encerrados os atalhos públicos /video/api/utmify-order e /video/api/fb-purchase (e seus handlers reutilizáveis). Todos os métodos retornam410/no-store sem ler corpo, credenciais ou banco e sem chamadas externas. Não eram usados pelo frontend atual. Fluxos internos de pagamento confirmado continuam usando leads-store/purchase-tracking; Utmify mantida. Destino central Verdefy não foi ativado.

Corrigido o carregador de scripts/purchase-tracking.test.mjs: import normal do módulo, preservando dependências relativas e testes reais com interceptação de provedores.

Validação:29 testes de tracking/Verdefy/migração/diagnóstico/reconciliador/atalhos passaram; test:multisite passou. Verificação ampliada de purchase-routes:22passam/4falham também na versãoHEAD anterior (comparação isolada sem editar o pacote anterior). São pendências preexistentes: dois mocks do admin não acompanham paginação, texto antigo da página e contextoPRODUCTS ausente no teste de preço. Não declarar a suíte completa verde. Nenhuma compra ou evento real foi produzido.

Antes da publicação: préviaHTTP isolada sem credenciais confirmou o handler410. Alteração apenas backend/testes, sem mudança de HTML/estilos/taxas/gateway/segredos. Sem migração de banco. Reversão por commit/Pages anterior possível, mas reabre atalhos; preferir correção aditiva.


## Atualização da base remota
Foram integrados quatro commits remotos até5a964c4, preservando migraçãoWorkers, domínio loja-oficial, otimização de imagens e configuraçãoWorkersBuilds. Testes do reconciliador agora fornecem SITE_URL explicitamente e verificam que sua ausência impede chamadas. Nenhuma mudança na rotina de produção do reconciliador foi publicada por esta etapa.

O proprietário confirmou que usa https://gokoco-tiktok.loja-oficial.workers.dev nos anúncios. A APICloudflare, nesta sessão, mostrou apenas7bindings no Worker principal (assets/KV/variáveis públicas), sem segredos de banco/login/gateways. O Pages anterior continua com os segredos. Não há como recuperar os valores criptografados do Pages pelaAPI. O cadastro no Worker é um bloqueio real para operação, independente do bloqueio dos atalhos de eventos. Não copiar valores paraGit/chat. Publicação da correção não equivale a checkout homologado.
