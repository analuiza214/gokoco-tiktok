// Eventos de compra só podem sair dos fluxos internos após confirmação do pagamento.
// Estes atalhos públicos antigos não consultavam pedido/gateway e foram encerrados.
export function retiredPurchaseRoute() {
  return Response.json({
    ok: false,
    code: 'legacy_purchase_route_disabled',
    error: 'Esta rota de eventos foi encerrada. O pagamento é processado pelo servidor da loja.'
  }, {status: 410, headers: {'Cache-Control': 'no-store'}});
}
