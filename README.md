# DesignPlat

Plataforma para transformar texto em peças visuais prontas para publicar.

| Ferramenta | Status |
|---|---|
| **Carrossel Tweet**: slides no estilo post do X/Twitter, escritos com IA e exportados em PNG | ✅ Pronto |
| **Post de Feed**: posts e carrosséis de Instagram com a identidade da marca (4 layouts, paletas, logo), criados a partir do texto do conteúdo | ✅ Pronto |
| Story (Instagram) | Planejado |
| Apresentação (PPTX/PDF) | Planejado |

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4**: interface e API no mesmo projeto.
- **Claude (`@anthropic-ai/sdk`)**: escreve os slides e a legenda, com saída estruturada validada por Zod.
- **Puppeteer + Chromium**: renderiza os templates HTML em PNG no servidor.
- **JSZip**: empacota os slides para download.

## Como funciona

A peça central são os **templates HTML** em `src/lib/templates/`. Cada template é uma função pura que recebe os dados (texto, perfil, estilo) e devolve um documento HTML com tamanho fixo (ex.: 1080×1440).

O mesmo HTML é usado em dois lugares:

1. **Preview no editor**: o HTML é mostrado num `<iframe>` reduzido (`src/components/SlideFrame.tsx`). O que você vê é exatamente a imagem final.
2. **Exportação**: a rota `/api/tweet/render` abre o HTML no Chromium e tira um print do tamanho exato (`src/lib/render/html-to-image.ts`).

O Chromium roda **sem JavaScript e sem acesso à rede**: só carrega o que está embutido no HTML (fontes e imagens em data URL). Isso deixa o resultado igual em qualquer máquina e impede que o conteúdo acesse endereços externos.

```
src/
├── app/
│   ├── page.tsx                    # tela inicial com as ferramentas
│   ├── tweet/page.tsx              # editor do Carrossel Tweet
│   ├── feed/page.tsx               # editor do Post de Feed
│   └── api/
│       ├── tweet/generate/route.ts # POST: gera slides + legenda com Claude
│       ├── tweet/render/route.ts   # POST: devolve PNG (?index=N) ou .zip com todos
│       └── feed/render/route.ts    # idem, para o Post de Feed
├── components/
│   ├── SlideFrame.tsx              # preview fiel de qualquer template HTML
│   ├── editor/                     # peças compartilhadas pelos editores (painéis, faixa de slides, preview…)
│   ├── tweet/                      # editor do Carrossel Tweet e rascunho salvo no navegador
│   └── feed/                       # editor do Post de Feed e rascunho salvo no navegador
└── lib/
    ├── formats.ts                  # tamanhos de canvas (3:4, 4:5, 1:1, 9:16, 16:9)
    ├── templates/                  # templates HTML (tweet.ts, feed.ts) + fontes + utilitários
    ├── render/                     # Chromium (singleton), HTML → PNG e resposta PNG/.zip
    ├── ai/                         # cliente Claude e prompt do carrossel
    ├── tweet/schema.ts, feed/schema.ts  # contratos das rotas (Zod)
    └── client/                     # chamadas à API e redimensionamento de imagens
```

## Rodando localmente

Requisitos: Node 22+ e Chromium ou Google Chrome instalado.

```bash
npm install
cp .env.example .env.local   # preencha ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Se o Chromium não for encontrado automaticamente, defina `CHROMIUM_PATH` no `.env.local`.

Verificações:

```bash
npm run typecheck
npm run lint
npm test
```

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sim, para "Gerar slides" | Geração de texto com Claude |
| `CLAUDE_MODEL` | Não | Troca o modelo (padrão: `claude-opus-5-5`) |
| `CHROMIUM_PATH` | Não | Caminho do Chromium usado na renderização |

## Deploy

O projeto precisa de um servidor Node com Chromium; plataformas serverless puras não servem. O `Dockerfile` já instala o Chromium e a fonte de emoji. No **Railway**, basta apontar o serviço para este repositório (ele detecta o Dockerfile) e configurar `ANTHROPIC_API_KEY`.

## Como adicionar as próximas ferramentas

**Story:** siga o caminho do Post de Feed: um template em `src/lib/templates/story.ts` usando `htmlDocument()` e o tamanho `story-9x16`, um schema, uma rota `api/story/render` (que só monta o HTML e chama `respondWithImages`) e um editor montado com as peças de `components/editor/`.

**Apresentação:** os slides também serão templates HTML em 16:9 (`slide-16x9`), com preview pelo mesmo `SlideFrame`. Para exportar:
- **PDF**: `page.pdf()` do Puppeteer sobre o mesmo HTML;
- **PPTX**: [`pptxgenjs`](https://gitbrent.github.io/PptxGenJS/), montando o arquivo a partir da mesma estrutura de dados do slide. Assim o texto continua editável no PowerPoint ou no Google Slides, em vez de virar imagem.

**Persistência:** hoje o rascunho fica no navegador (`localStorage`). Quando precisar de histórico, vários usuários ou biblioteca de marcas, o caminho natural é Supabase (banco + storage para os PNGs).
