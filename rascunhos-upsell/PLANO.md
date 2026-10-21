# Upsell — planejamento registrado em 21/10/2026

Status: apenas esboços locais. Nenhum deploy, push, alteração de checkout, rota ou gateway.

## Fluxo solicitado para integração futura
1. Receber confirmação real do pagamento aprovado.
2. Manter a confirmação visível, sem sumiço ou redirecionamento automático.
3. Preservar a apresentação da confirmação e deixar apenas um botão verde: “Continuar”.
4. Abrir o upsell da respectiva loja somente após o clique.
5. A compra complementar é opcional e deve ter cobrança e confirmação próprias. Não cobrar pelo clique em “Continuar”.

## Esboços
- original.html: estrutura preliminar da versão original.
- bella.html: estrutura preliminar da Bella Mix.
- tl.html: estrutura preliminar da TL.

As três páginas são independentes, responsivas e sem scripts externos, pixels ou chamadas de rede. Os botões apenas exibem uma mensagem de simulação.
As cores são preliminares; confirmar o mapeamento da versão TL e conferir cabeçalhos, logos e identidade contra cada versão atual antes da finalização.

## Aguardando definição do produto
Nome, fotos, benefícios comprováveis, preço, condições, entrega e destino de quem recusar a oferta. Não inventar descontos, depoimentos ou escassez.

## Integração futura
Verificar no código ativo a causa do desaparecimento da confirmação. Preservar o status e os dados do pedido principal e os eventos de conversão existentes. Tratar pagamento do upsell separadamente e impedir duplicidade de cobrança. Testar aprovação, permanência da tela, clique manual, aceite e recusa em ambiente de teste antes de publicar.
