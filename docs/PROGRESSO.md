# Progresso do projeto

Anotações para retomar o trabalho em qualquer conversa. Última atualização: 08/10/2026.

## Origem

A ferramenta Carrossel Tweet foi replicada da **Central Mantora**, que fica em dois repositórios:

- Frontend: `equipemantoralab-cell/mantoradashoficial`, arquivo `src/components/studio/TweetCarouselEditor.tsx`
- Backend (Railway, pasta `/sync`): `Clarisse-lab/mantoradash`, arquivos `sync/src/workers/content-studio/tweetCardRenderer.ts`, `imageWorker.ts` e `calendarWorker.ts` (prompt `buildPromptCarrosselTweet`)

## O que já está pronto

- **Carrossel Tweet** funcionando: editor, geração de texto com IA, preview e exportação em PNG ou `.zip`.
- Publicado no Railway: https://web-production-78e6c.up.railway.app/tweet
  - Projeto `designplat`, serviço `web`, região us-west2
  - Publicado a partir do branch `claude/happy-tesla-j36oft`
- Pull request: https://github.com/Clarisse-lab/DesignPlat/pull/1 (aguardando merge)
- Testado pela Clarisse em produção: a página e o download do `.zip` funcionam.
- **Post de Feed** (`/feed`): 4 layouts por slide (Destaque, Texto, Citação, Foto), 5 paletas prontas + cores personalizadas, fonte de título moderna (Inter) ou elegante (Playfair Display), logo e @ da marca, numeração, proporções 4:5, 1:1 e 3:4. Cria os slides a partir de um texto colado (cada parágrafo vira um slide). Sem IA por enquanto.

## Decisões tomadas

- **Stack:** Next.js + TypeScript + Tailwind. Interface e API no mesmo projeto.
- **Imagens geradas por HTML:** os templates em `src/lib/templates/` são os mesmos no preview e no PNG final. O Chromium (Puppeteer) roda sem JavaScript e sem rede.
- **Railway em vez de Netlify:** o Netlify tem limite de 60 s por requisição e 6 MB por payload, e não vem com Chromium. O Railway roda o `Dockerfile` sem limite de tempo.
- **IA:** Claude Opus 5.5 por padrão (pode trocar com `CLAUDE_MODEL`), com fallback automático em caso de recusa.
- **Fonte Inter** guardada no projeto, no lugar da Chirp (que vinha do site do X).
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

- Geração com IA usando a chave real (até agora só foi testada contra uma API simulada).
