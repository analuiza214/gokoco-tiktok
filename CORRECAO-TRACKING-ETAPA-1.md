# Tracking — etapa1 — 07/11/2026

Encerrados os atalhos públicos /video/api/utmify-order e /video/api/fb-purchase (e seus handlers reutilizáveis). Todos os métodos retornam410/no-store sem ler corpo, credenciais ou banco e sem chamadas externas. Não eram usados pelo frontend atual. Fluxos internos de pagamento confirmado continuam usando leads-store/purchase-tracking; Utmify mantida. Destino central Verdefy não foi ativado.

Corrigido o carregador de scripts/purchase-tracking.test.mjs: import normal do módulo, preservando dependências relativas e testes reais com interceptação de provedores.

Validação:28testes de tracking/Verdefy/migração/diagnóstico/reconciliador/atalhos passaram; test:multisite passou. Verificação ampliada de purchase-routes:22passam/4falham também na versãoHEAD anterior (comparação isolada sem editar o pacote anterior). São pendências preexistentes: dois mocks do admin não acompanham paginação, texto antigo da página e contextoPRODUCTS ausente no teste de preço. Não declarar a suíte completa verde. Nenhuma compra ou evento real foi produzido.

Antes da publicação: préviaHTTP isolada sem credenciais confirmou o handler410. Alteração apenas backend/testes, sem mudança de HTML/estilos/taxas/gateway/segredos. Sem migração de banco. Reversão por commit/Pages anterior possível, mas reabre atalhos; preferir correção aditiva.
