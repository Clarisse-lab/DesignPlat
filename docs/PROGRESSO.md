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

## Plano do Estúdio (estilo MyPostFlow), decidido em 04/11/2026
1. Base: login, cliente e kit, Gemini (feito).
2. Salvar peças e templates no Supabase (hoje o rascunho fica só no navegador).
3. Editor por elementos: cada slide com fundo, sombra e elementos posicionáveis (texto, foto, etiqueta, cartão, ícone, perfil), arrastar e soltar, tamanhos em px, marca-texto, rodapé e barras de progresso. Os layouts atuais viram pontos de partida.
4. Imagens: tiras e grade na capa, carrossel infinito (panorama) e edição de imagem com IA.
5. Assistente "gerar com IA" ligado ao Motor de Conteúdo (pauta → copy → brief → peça), "gerar este slide" e legenda.
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
