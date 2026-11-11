# Progresso do projeto

> A plataforma se chama **Design Mantora** (antes "DesignPlat"; o repositório continua `Clarisse-lab/DesignPlat`).

Anotações para retomar o trabalho em qualquer conversa. Última atualização: 04/11/2026.

## Origem

A ferramenta Carrossel Tweet foi replicada da **Central Mantora**, que fica em dois repositórios:

- Frontend: `equipemantoralab-cell/mantoradashoficial`, arquivo `src/components/studio/TweetCarouselEditor.tsx`
- Backend (Railway, pasta `/sync`): `Clarisse-lab/mantoradash`, arquivos `sync/src/workers/content-studio/tweetCardRenderer.ts`, `imageWorker.ts` e `calendarWorker.ts` (prompt `buildPromptCarrosselTweet`)

## O que já está pronto

- **Carrossel Tweet** funcionando: editor, geração de texto com IA, preview e exportação em PNG ou `.zip`. Fonte do card: Inter ou Poppins.
- Publicado no Railway: https://designmantora.up.railway.app (endereço antigo `web-production-78e6c.up.railway.app` desativado em 08/10/2026)
  - Projeto `designplat`, serviço `web`, região us-west2
  - Publicado a partir do branch `main`: o que é feito no branch `claude/happy-tesla-j36oft` só entra no ar depois do merge do PR
- PR #1 (primeira versão do Carrossel Tweet) e PR #2 (Post de Feed, Pixabay, nome Design Mantora, Poppins) mergeados.
- Testado pela Clarisse em produção: a página e o download do `.zip` funcionam.
- **Post de Feed** (`/feed`):
  - 8 layouts por slide: Destaque, Texto, Lista, Número, Citação, Antes × Depois, Foto e Celular (mockup), mais "Da referência" quando criado pela IA.
  - 32 ícones, decorações de fundo (formas, pontos, degradê, moldura), alinhamento e posição do texto, tamanho dos títulos, fundo do Destaque.
  - 5 fontes de título: Moderna (Inter), Elegante (Playfair Display), Impacto (Bebas Neue), Geométrica (Montserrat), Manuscrita (Caveat). 8 paletas prontas + cores personalizadas.
  - Cria os slides a partir de um texto colado (cada parágrafo vira um slide).
  - Busca de fotos grátis no Pixabay (`PIXABAY_API_KEY`, já configurada no Railway). O Pexels foi descartado porque pausou a emissão de chaves novas.
  - Imagem de referência: "Inspirar" (grátis, sem IA: cores + OCR para posição/alinhamento/layout) e "Copiar estilo com IA" (Claude cria um layout HTML/CSS no estilo; precisa da chave da Anthropic).
- **Story** (`/story`), 16/10/2026:
  - Mesmo editor e template do Post de Feed, em 1080×1920. Rascunho separado (`designplat:story-draft:v1`) e download em `stories.zip`.
  - Faixas de segurança: 13% no topo (perfil e barra) e 17% na base (campo de resposta) ficam livres de texto. O preview mostra essas faixas (dá para esconder).
  - Layouts exclusivos: "Enquete / Pergunta" (deixa um espaço vazio, marcado no preview, para colar o sticker no Instagram) e "Chamada (link)" (botão "Toque no link").
  - Celular e Antes × Depois ficam empilhados no formato vertical.
  - Botão "Importar do Post de Feed" traz os slides do rascunho do Feed.
- **Apresentação** (`/apresentacao`), 19/10/2026:
  - Mesmo editor e template do Post de Feed, em 1920×1080. Rascunho separado (`designplat:presentation-draft:v1`).
  - Layouts exclusivos: "Seção" (divisória com número automático 01, 02…) e "Colunas" (até 4 cards). No 16:9 a foto fica ao lado do texto e listas com mais de 4 itens viram duas colunas.
  - Notas do apresentador em cada slide (não aparecem no slide; vão para as anotações do PPTX).
  - Download em PDF (texto selecionável), PowerPoint (PPTX, slides como imagem) ou imagens (.zip).

- **API de integração** (`/api/v1/pecas`), 04/11/2026: o Escritório virtual (`equipemantoralab-cell/escritoriomantora`) envia a peça em JSON e recebe os PNGs. Protegida pela chave `DESIGN_API_KEY` (Bearer). Primeira etapa da integração com o Motor de Conteúdo: a peça gerada vai direto para aprovação no Escritório.
- **Leitor de identidade** (`/api/v1/identidade`), 04/11/2026: recebe as imagens dos posts de melhor desempenho do cliente (o Escritório busca pela função `instagram-midias` do Supabase, com o token da Meta) e sugere o kit de marca com o mesmo código do "Inspirar", rodando no Chromium do servidor. Sem IA e sem custo.

- **Estúdio, etapa 1** (04/11/2026): login Google da equipe (mesma lista `equipe` do Escritório, pelo Supabase), painel **Cliente** que aplica o kit de marca confirmado no Escritório, **Fotos do cliente** (posts do Instagram dele) e **Gerar com IA** (Gemini) com o rosto do cliente, custo registrado em `uso_ia` e limite mensal (`LIMITE_MENSAL_IMAGENS_USD`).

- **Biblioteca de modelos do Livre** (05/11/2026): 26 modelos em miniatura (12 capas, 11 telas internas, 3 de fechamento), inspirados no MyPostFlow e além: revista, marca-texto, editorial serifado, centro com etiqueta, impacto condensado, perfil + título gigante, 2 e 3 tiras, tweet, manchete de jornal, número gigante, pergunta; título + texto, cartão, cartão com foto, tweet com imagem, dado em destaque, checklist, passo a passo, mito × verdade, antes × depois, citação com foto; salve, siga, comente. Elementos ganharam fonte própria, itálico, sombra, ícone, perfil em 3 estilos (com selo de verificado) e textos automáticos ({nome}, {usuario}, {n}, {total}). Trocar de modelo leva o texto e as fotos do slide. O assistente escolhe o modelo pelo tipo de tela e não deixa texto de exemplo.

- **Estúdio automático** (05/11/2026): o assistente entrega o carrossel pronto em um clique. A IA escolhe o modelo de cada tela no catálogo do Livre e escreve a descrição da foto (e se ela mostra o cliente); o painel tem **Capa** e **Telas internas** (a IA escolhe ou a equipe fixa) e **Imagens com IA** (não gerar, só a capa ou todas as telas com foto). As imagens saem uma por vez pelo Gemini, com o rosto do cliente quando a tela pede, e o custo aparece no fim. Botão **Outra versão** no topo sorteia outros modelos mantendo texto e fotos (não mexe em listas, dados, passos e citações). Na aba Modelos, **Aplicar em todas as telas internas**. Cada slide Livre guarda o modelo de origem (`free.preset`).
- **Imagens mais inteligentes e Print de conversa** (10/11/2026), com ideias da `ads-creative-factory` (repo `marketingLendario/cohort-de-marketing`, MIT; análise em `claude/analise-cohort-de-marketing.md` no projeto do Claude):
  - **Gerar com IA** deixa livre a área onde o layout põe o texto (embaixo, em cima, esquerda, direita, centro ou nenhuma), calculada pelos elementos do slide Livre; dá para trocar no diálogo. Imagem de elemento (foto, tira, grade) vai sem zona.
  - **Estilo** da imagem: Automático, Foto natural, Editorial, Produto / objeto, Conceito.
  - **Variação**: cada imagem sorteia luz, enquadramento e fundo; **Outra versão** gera de novo sem repetir combinação. Regras novas no prompt: fundo nunca liso, sem "cara de IA" (pele de plástico, neon roxo/azul, dedos errados) e o rosto do cliente fiel (sem embelezar, afinar ou envelhecer). Instruções em `src/lib/ai/image-direction.ts`.
  - Elemento **Print de conversa** no Livre (só HTML, custo zero de IA): conversa em modo escuro ou claro, ou notificações na tela bloqueada, com o nome e a logo do cliente. Modelos novos: **Print de conversa** (capa e tela interna) e **Notificações** (capa). Uma mensagem por linha; "Eu:" vira a resposta.
  - Os campos novos da rota `/api/estudio/imagem` (`zona`, `estilo`, `evitar`) são opcionais: quem não manda (Estúdio automático do PR #18) recebe o comportamento de antes. Os 3 modelos novos entraram no guia do assistente (`MODEL_GUIDE`).

- **Nada se perde** (10/11/2026). Antes, das 6 imagens e 5 carrosséis gerados com IA, só 2 peças estavam salvas.
  - **Toda imagem gerada fica guardada**, mesmo sem ir para o slide: arquivo no bucket `design` (pasta `geradas/`) e linha na tabela `design_imagens` (cliente, pedido, estilo, zona, proporção, se usou rosto, custo, quem gerou). A miniatura é feita no navegador e vai para `geradas/miniaturas/`. Se guardar falhar, a geração não falha (só fica no log).
  - **Aba "Já geradas"** no Gerar com IA (slide, elemento de imagem e panorama): galeria do cliente ou de todos, e usar uma imagem de lá não gasta nada. Rotas `/api/estudio/imagens` (lista com link temporário) e `/api/estudio/imagens/[id]` (imagem inteira e miniatura).
  - **Salvamento automático** no Feed, no Story e na Apresentação: 4 s depois de cada mudança a peça vai para `design_pecas`, marcada como `rascunho` até alguém usar "Dar nome e salvar". Em "Abrir peça", os rascunhos aparecem com a etiqueta "rascunho automático". O topo mostra "Salvo às HH:MM".
  - **Gerar carrossel de novo cria uma peça nova**; a anterior continua salva.
  - O servidor não sobe de novo uma foto que já subiu (o nome é o hash), para o salvamento automático não reenviar as fotos a cada mudança.
  - Ainda sem salvamento: o Carrossel Tweet (ferramenta separada).
- **Correção: carrossel "preso" e peça de outro cliente** (10/11/2026):
  - O "Gerar carrossel" perguntava "Substituir os slides atuais?" depois de 20 a 40 s de espera. Com a pessoa em outra aba, o Chrome cancelava a pergunta e as telas pagas eram descartadas. Agora não pergunta: salva o carrossel atual e monta o novo.
  - Trocar de cliente salva o carrossel do anterior e começa limpo com o kit do novo (antes ficavam os slides do outro cliente).
  - O rascunho do navegador guarda a assinatura do que está igual no Supabase (`syncKey`). Se ao abrir a página ele aponta para uma peça mas tem mudanças nunca salvas, vira peça nova. Foi assim que a peça da Sabrina "Antes de contratar uma agência…" acabou com o carrossel da Black Friday (Template Hosaka).

- **Biblioteca de estilos e Colagem editorial** (11/11/2026). Análise do Instagram da Sabrina em `claude/estilos-sabrina-nascimento.md` (projeto do Claude): ela alterna 5 linguagens.
  - Tabela `design_estilos` (nome, cliente ou agência, padrão, dados: modelos, cores e fonte, estilo e orientação das imagens, tom do texto) e rota `/api/estudio/estilos`. Um padrão por cliente.
  - **Gerar carrossel**: campo **Estilo**, que já vem no padrão do cliente. Com estilo, a IA usa só os modelos dele e segue o tom e a orientação de imagens; o carrossel recebe as cores e a fonte do estilo (logo, nome e @ continuam os do kit). Sem estilo, funciona como antes.
  - Fonte **Máquina de escrever** (Cutive, OFL, em WOFF em `public/fonts`).
  - Livre: fundos **Papel amassado**, **Papel no tom do destaque** e **Escuro com grão** (SVG puro, sem imagem); destaque **Caneta marca-texto**; imagem como **recorte de colagem** (sem moldura, some no papel).
  - Estilo de imagem **Recorte retrô** (gravura P&B em meio-tom, fundo branco), usado sozinho nos recortes.
  - Modelos **Colagem: capa / item / fechamento**; os títulos encolhem sozinhos para caber (`fitFontSize`).
  - Primeiro estilo: **Colagem editorial**, padrão da Sabrina. Próximos: Cultura pop escuro, Texto nativo vinho, Meme comparativo; Tweet ligado ao kit.

## Plano do Estúdio (estilo MyPostFlow), decidido em 04/11/2026
1. Base: login, cliente e kit, Gemini (feito).
2. Salvar peças e templates no Supabase (feito em 04/11/2026: tabela `design_pecas`, imagens no bucket privado `design`, botões Abrir, Salvar e Salvar como template no Post de Feed, Story e Apresentação).
3. Editor por elementos (primeira versão em 04/11/2026): layout **Livre** com fundo (cor, destaque ou foto), sombra ajustável, barras de progresso e elementos posicionados em % (título, texto, etiqueta, perfil, Arraste →, numeração, imagem, cartão), arrastar e redimensionar na prévia, tamanho em px, marca-texto, caixa alta e 5 modelos prontos (Capa revista, Capa marca-texto, Interno com cartão, Interno simples, Foto em cima). Template em `src/lib/templates/free.ts`; editor em `src/components/feed/FreeEditor.tsx`.
4. Imagens (04/11/2026): elemento **Tiras / grade** (2 ou 3 tiras, 2 faixas, 2 × 2) e modelos Capa com 2/3 tiras; **carrossel infinito** (a foto de fundo é espalhada por 2 a 5 slides, com "Gerar foto larga com IA" em 16:9 ou 21:9); **editar a imagem atual com IA** (o Gemini muda só o que foi pedido); elemento Imagem e cada tira aceitam upload, fotos do cliente e IA. Panorama com o modelo padrão (1K) fica menos nítido: para isso, `gemini-3.1-flash-image-preview` dá mais resolução.
5. Assistente (04/11/2026): painel **Gerar carrossel com IA** no Post de Feed. Parte de uma pauta com copy aprovada do Motor de Conteúdo (tabela `pautas`) ou de um tema, o Claude (`CLAUDE_MODEL_CARROSSEL`, padrão Sonnet 5.5) devolve as telas e a legenda, e o editor monta os slides com os modelos do Livre (estilo revista) ou com os layouts clássicos. Custo em `uso_ia` (tipo `carrossel`). No Escritório, a pauta com copy ganha o botão **Montar no Design Mantora** (`/feed?cliente=<slug>&pauta=<id>`). Falta: "gerar este slide" com IA.
- Decisões: o estúdio fica no Design Mantora (Railway); o rosto do próprio cliente pode ser usado em todos os clientes (previsto em contrato); Gemini na mesma conta do Prisma, com limite de gasto; nunca gerar outras pessoas reais identificáveis.

## Decisões tomadas

- **Stack:** Next.js + TypeScript + Tailwind. Interface e API no mesmo projeto.
- **Imagens geradas por HTML:** os templates em `src/lib/templates/` são os mesmos no preview e no PNG final. O Chromium (Puppeteer) roda sem JavaScript e sem rede.
- **Railway em vez de Netlify:** o Netlify tem limite de 60 s por requisição e 6 MB por payload, e não vem com Chromium. O Railway roda o `Dockerfile` sem limite de tempo.
- **IA:** Claude Opus 5.5 por padrão (pode trocar com `CLAUDE_MODEL`), com fallback automático em caso de recusa.
- **Fonte Inter** guardada no projeto, no lugar da Chirp (que vinha do site do X).
- **Imagens geradas por IA:** liberadas em 04/11/2026 com o Gemini (antes ficaram de fora para explorar o HTML e o Pixabay).
- **OCR servido pela própria plataforma** (sem CDN), para funcionar mesmo se um CDN estiver bloqueado.
- **Rascunho salvo só no navegador** (`localStorage`). Nada fica salvo no servidor e as imagens só existem se forem baixadas.
- **PPTX com slides em imagem:** fica idêntico ao preview e pronto para apresentar, mas o texto não é editável no PowerPoint. Um PPTX editável exigiria recriar cada layout com formas nativas; fica como melhoria futura, se for preciso.
- Bugs da Central Mantora corrigidos aqui: o formato `carrossel-tweet` não ativava o prompt de tweet, e o preview era diferente da imagem final.

- **Integração com o Escritório (04/11/2026):** o Design Mantora continua no Railway e o Escritório chama a API. Imagem gerada por IA fica de fora (custo); as peças saem dos templates HTML. A peça vai direto para aprovação no Escritório; ajuste no editor fica para depois.

## Próximos passos

1. **Senha de acesso:** hoje o link está aberto para qualquer pessoa. Fazer antes de ligar a IA, para ninguém gastar os créditos da Anthropic. (A Clarisse decidiu adiar enquanto a IA não for ligada.)
2. **Configurar `ANTHROPIC_API_KEY`** no Railway (serviço `web` → Variables) e testar o "Gerar slides" com a chave real.
3. **Histórico de carrosséis salvos** com Supabase (opcional, se for útil).
4. **PPTX editável** (opcional): recriar os layouts com formas nativas do PowerPoint.
5. **IA no Post de Feed, no Story e na Apresentação:** gerar os slides a partir de um tema, como no Carrossel Tweet (quando a IA for ligada).

## Pendências de teste

- Geração com IA usando a chave real (até agora só foi testada contra uma API simulada): Carrossel Tweet e "Copiar estilo com IA".
- Busca de fotos com a chave real do Pixabay (a rede da sessão de desenvolvimento bloqueia o Pixabay; conferir em produção).
