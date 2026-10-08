# Progresso do projeto

> A plataforma se chama **Design Mantora** (antes "DesignPlat"; o repositório continua `Clarisse-lab/DesignPlat`).

Anotações para retomar o trabalho em qualquer conversa. Última atualização: 08/10/2026.

## Origem

A ferramenta Carrossel Tweet foi replicada da **Central Mantora**, que fica em dois repositórios:

- Frontend: `equipemantoralab-cell/mantoradashoficial`, arquivo `src/components/studio/TweetCarouselEditor.tsx`
- Backend (Railway, pasta `/sync`): `Clarisse-lab/mantoradash`, arquivos `sync/src/workers/content-studio/tweetCardRenderer.ts`, `imageWorker.ts` e `calendarWorker.ts` (prompt `buildPromptCarrosselTweet`)

## O que já está pronto

- **Carrossel Tweet** funcionando: editor, geração de texto com IA, preview e exportação em PNG ou `.zip`.
- Publicado no Railway: https://designmantora.up.railway.app (endereço antigo `web-production-78e6c.up.railway.app` desativado em 08/10/2026)
  - Projeto `designplat`, serviço `web`, região us-west2
  - Publicado a partir do branch `claude/happy-tesla-j36oft`
- Pull request: https://github.com/Clarisse-lab/DesignPlat/pull/1 (aguardando merge)
- Testado pela Clarisse em produção: a página e o download do `.zip` funcionam.
- **Post de Feed** (`/feed`):
  - 8 layouts por slide: Destaque, Texto, Lista, Número, Citação, Antes × Depois, Foto e Celular (mockup), mais "Da referência" quando criado pela IA.
  - 32 ícones, decorações de fundo (formas, pontos, degradê, moldura), alinhamento e posição do texto, tamanho dos títulos, fundo do Destaque.
  - 5 fontes de título: Moderna (Inter), Elegante (Playfair Display), Impacto (Bebas Neue), Geométrica (Montserrat), Manuscrita (Caveat). 8 paletas prontas + cores personalizadas.
  - Cria os slides a partir de um texto colado (cada parágrafo vira um slide).
  - Busca de fotos grátis no Pixabay (`PIXABAY_API_KEY`, já configurada no Railway). O Pexels foi descartado porque pausou a emissão de chaves novas.
  - Imagem de referência: "Inspirar" (grátis, sem IA: cores + OCR para posição/alinhamento/layout) e "Copiar estilo com IA" (Claude cria um layout HTML/CSS no estilo; precisa da chave da Anthropic).

## Decisões tomadas

- **Stack:** Next.js + TypeScript + Tailwind. Interface e API no mesmo projeto.
- **Imagens geradas por HTML:** os templates em `src/lib/templates/` são os mesmos no preview e no PNG final. O Chromium (Puppeteer) roda sem JavaScript e sem rede.
- **Railway em vez de Netlify:** o Netlify tem limite de 60 s por requisição e 6 MB por payload, e não vem com Chromium. O Railway roda o `Dockerfile` sem limite de tempo.
- **IA:** Claude Opus 5.5 por padrão (pode trocar com `CLAUDE_MODEL`), com fallback automático em caso de recusa.
- **Fonte Inter** guardada no projeto, no lugar da Chirp (que vinha do site do X).
- **Ilustrações e fotos geradas por IA ficaram de fora por enquanto:** a Clarisse preferiu explorar ao máximo o HTML (layouts, ícones, decorações) e fotos reais de banco gratuito (Pixabay).
- **OCR servido pela própria plataforma** (sem CDN), para funcionar mesmo se um CDN estiver bloqueado.
- **Rascunho salvo só no navegador** (`localStorage`). Nada fica salvo no servidor e as imagens só existem se forem baixadas.
- Bugs da Central Mantora corrigidos aqui: o formato `carrossel-tweet` não ativava o prompt de tweet, e o preview era diferente da imagem final.

## Próximos passos

1. **Senha de acesso:** hoje o link está aberto para qualquer pessoa. Fazer antes de ligar a IA, para ninguém gastar os créditos da Anthropic. (A Clarisse decidiu adiar enquanto a IA não for ligada.)
2. **Configurar `ANTHROPIC_API_KEY`** no Railway (serviço `web` → Variables) e testar o "Gerar slides" com a chave real.
3. **Fazer o merge do PR** e apontar o Railway para o branch `main`.
4. **Histórico de carrosséis salvos** com Supabase (opcional, se for útil).
5. **Próximas ferramentas:** Story e Apresentação (PPTX/PDF). O README explica como encaixar cada uma.
6. **IA no Post de Feed:** gerar os slides a partir de um tema, como no Carrossel Tweet (quando a IA for ligada).

## Pendências de teste

- Geração com IA usando a chave real (até agora só foi testada contra uma API simulada): Carrossel Tweet e "Copiar estilo com IA".
- Busca de fotos com a chave real do Pixabay (a rede da sessão de desenvolvimento bloqueia o Pixabay; conferir em produção).
