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

## Demonstração implementada
- Kit Proteção & Brilho: protetor térmico + sérum, R$ 29,90 de teste.
- Recusa abre oferta de somente protetor, R$ 19,90 de teste; segunda recusa encerra a simulação.
- Aceite abre resumo e confirmação simulada; sem rede de pagamento, cadastro, armazenamento ou eventos de conversão.
- Botão no rodapé permite testar a confirmação de pagamento, que permanece aberta até “Continuar” ou fechamento explícito. A página de pagamento real permanece intacta.
- Galeria com imagens geradas de produtos fictícios; avaliações, estrelas e fotos claramente identificadas como ilustrativas. Substituir por produto e avaliações reais antes de produção.
- Tutorial externo: https://www.youtube.com/watch?v=PW7swU9ReKI (referência de categoria, não do kit); player carrega só após clique, com alternativa de abrir no YouTube. Reprodução ainda não verificada.
- Orientação educativa de referência: https://www.tresemme.com/br/look/tutoriais.html
- Original: GOKOCO, preto e rosa. Bella: Bella Mix, dourado e verde. TL: amarelo, conforme a base local da versão /tl/.
- Arquivos desta pasta não são incluídos pelo scripts/prepare-deploy.mjs atual. Nenhuma configuração de publicação foi alterada.

## Revisão
Sintaxe JavaScript e simulação automatizada de interações verificadas. Revisão visual no navegador bloqueada: servidor local inacessível neste ambiente e protocolo file: não permitido. Conferir desktop/mobile e reprodução do vídeo manualmente antes da integração.

## Publicação das demonstrações — 21/10/2026
Rotas preparadas: /upsell1 (Original), /tl/upsell1 (TL), /video/upsell1 (Bella).
Conteúdo público permanece em modo demonstração: sem cobrança, sem eventos de compra e com avaliações identificadas como fictícias.
Nenhum arquivo de checkout ou de confirmação de pagamento foi modificado. Não há encaminhamento de clientes para o upsell.
Builds das duas lojas, empacotamento, sintaxe JS e testes multi-site passaram; aceite e recusa foram conferidos na versão online de teste.
Revisão de código: https://github.com/analuiza214/gokoco-tiktok/pull/2

Publicação confirmada no domínio principal e páginas abertas no navegador:
- https://gokoco-tiktok.pages.dev/upsell1
- https://gokoco-tiktok.pages.dev/tl/upsell1
- https://gokoco-tiktok.pages.dev/video/upsell1
Merge de publicação: 7014bd6054ea835e210b57dddb3f3658833755b2. As três páginas responderam com a identidade e o conteúdo de demonstração corretos.

## Correção de estrutura — 21/10/2026
A pedido do usuário, os upsells deixam de usar o layout editorial inicial e passam a reutilizar as estruturas das lojas:
- Original: HTML e classes do index.html, com produto, descrição, galeria e exemplos de avaliações substituídos.
- TL: componente ProductPage e CSS da loja Mercado, com dados do kit e carrinho isolado em demonstração.
- Bella: componente Product, Header e Footer e CSS da Bella, com produto e avaliações ilustrativas do kit.
O gerador scripts/build-upsell.mjs é executado ao final do empacotamento. Não modifica os arquivos-fonte das lojas, o checkout ou o pós-pagamento.
Validação: builds e testes locais passaram; preview Cloudflare aprovado; galerias, compra Original, compra Bella e finalizar carrinho TL verificados no navegador, sem cobrança.
Revisão: https://github.com/analuiza214/gokoco-tiktok/pull/3
Commit integrado: a0f92d14547b0a8feb67452874c41b9e54095ed0.

Correção publicada e conferida no domínio principal: /upsell1 agora usa TikTok, /tl/upsell1 usa ProductPage Mercado, /video/upsell1 usa Product/Header/Footer Bella. Conteúdo do kit e avaliações ilustrativas confirmados nas três páginas. Fluxo pós-pagamento permanece sem alteração.
