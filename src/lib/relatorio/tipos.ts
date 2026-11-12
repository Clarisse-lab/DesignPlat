// Relatório do cliente (semanal ou mensal): formato dos dados (servidor, aba Relatórios e link do cliente).

export type TipoPeriodo = "semana" | "mes";

/** Um momento de destaque calculado pelo sistema (recorde, comparação com o normal do perfil). */
export interface Marco {
  /** Frase curta em cima do número: "Seu post mais visto em 90 dias". */
  titulo: string;
  /** O número em destaque, já formatado: "342 mil", "4,2x". */
  valor: string;
  /** Uma frase explicando: "O post de humor alcançou 342 mil pessoas, 11x o normal de um post seu." */
  texto: string;
  /** Post ligado ao momento (mostra a capa). */
  media_id?: string;
}

/** O "normal" do perfil: medianas dos posts dos 90 dias antes do período. */
export interface Historico {
  desde: string;
  posts: number;
  mediana_alcance: number | null;
  mediana_salvos_compart: number | null;
  /** Interações por alcance (%). */
  mediana_engajamento: number | null;
}

/** Um número da semana com a comparação com a semana anterior (null = sem base para comparar). */
export interface Kpi {
  valor: number | null;
  anterior: number | null;
}

export interface PostSemana {
  media_id: string;
  publicado_em: string;
  formato: "Reels" | "Carrossel" | "Foto" | "Vídeo";
  legenda: string;
  permalink: string | null;
  alcance: number | null;
  interacoes: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  visualizacoes: number | null;
  /** Caminho da capa no bucket (guardada na hora de gerar, porque o link da Meta expira). */
  capa: string | null;
}

export interface DadosSemana {
  /** Instagram ligado ao cliente? Sem conta, a seção some. */
  instagram: {
    contas: string[];
    seguidores: number | null;
    novos_seguidores: Kpi;
    posts: Kpi;
    alcance: Kpi;
    interacoes: Kpi;
    salvos_compart: Kpi;
    visualizacoes: Kpi;
    /** Posts da semana (ordem de publicação) e os 3 melhores. */
    lista: PostSemana[];
    melhores: string[];
    formatos: { formato: string; posts: number; alcance: number }[];
    /** Data da coleta usada (as métricas do Instagram são coletadas uma vez por semana). */
    medido_em: string | null;
    parcial: boolean;
    /** O normal do perfil e os posts acima e abaixo dele (por alcance em relação à mediana). */
    historico?: Historico | null;
    /** Alcance de um período típico do perfil (mediana dos anteriores), para a leitura do número. */
    alcance_tipico?: number | null;
    acima?: string[];
    abaixo?: string[];
  } | null;
  /** Recordes e comparações com o normal do perfil, calculados pelo sistema. */
  marcos?: Marco[];
  leads: { total: Kpi; origens: { origem: string; total: number }[] } | null;
  /** Entregas que o sistema vê sozinho (peças aprovadas pelo cliente no link de aprovação). */
  aprovadas: { titulo: string; em: string }[];
  /** Tráfego pago lido do Meta Ads (contas de anúncio do cliente), período atual e anterior. */
  meta_ads?: { atual: MetaNumeros; anterior: MetaNumeros | null; contas: string[]; em: string } | null;
  /** Números da conta no período (pessoas diferentes, não soma dos posts), atual e anterior. */
  conta_ig?: { atual: ContaIg; anterior: ContaIg | null; /** Pessoas alcançadas num período típico (mediana dos 4 anteriores). */ tipico_alcance?: number | null } | null;
  /** Quem segue o perfil: idade, gênero e cidades (em %). */
  publico?: Publico | null;
  /** Comentários recentes dos posts do período (internos: o cliente só vê os escolhidos em textos.palavras). */
  comentarios?: { media_id: string; texto: string; curtidas: number }[];
  /** Engajamento comparado com perfis do nicho (os nomes dos perfis são internos). */
  nicho?: Nicho | null;
  /** O que depende do cliente: material pendente no ClickUp e peças esperando aprovação. */
  pendencias?: Pendencia[];
  /** Mês: como o perfil estava quando começamos a acompanhar e como está agora. */
  antes_depois?: AntesDepois | null;
  /** Trabalho da Mantora no ClickUp. As listas de tarefas são internas (o link do cliente só recebe a contagem). */
  trabalho?: TrabalhoPeriodo | null;
  foto_perfil: string | null;
}

export interface ContaIg {
  /** Contas alcançadas (pessoas diferentes). */
  alcance: number;
  visualizacoes: number;
  /** Contas que interagiram. */
  engajadas: number;
  interacoes: number;
  seguiram: number | null;
  deixaram: number | null;
}

export interface Publico {
  idade: { faixa: string; pct: number }[];
  mulheres: number | null;
  homens: number | null;
  cidades: { cidade: string; pct: number }[];
}

export interface Nicho {
  /** Engajamento médio por post (curtidas + comentários / seguidores, %), pela mesma régua para todos. */
  cliente: number | null;
  media: number | null;
  /** Quantas vezes a média do nicho. */
  vezes: number | null;
  /** Fica entre os X% com mais engajamento. */
  topo_pct: number | null;
  total: number;
  perfis: { perfil: string; seguidores: number; engajamento: number | null }[];
  /** Perfis que não entraram na conta e por quê (interno). */
  fora?: { perfil: string; motivo: string }[];
}

export interface Pendencia {
  titulo: string;
  /** Reels, Carrossel, Aprovação... */
  tipo: string;
  /** YYYY-MM-DD */
  desde: string | null;
  /** Link de aprovação, quando é uma peça para aprovar. */
  link?: string | null;
}

export interface AntesDepois {
  antes: { rotulo: string; mediana_alcance: number | null; mediana_salvos_compart: number | null; posts: number };
  depois: { rotulo: string; mediana_alcance: number | null; mediana_salvos_compart: number | null; posts: number };
  /** media_id dos 3 posts de maior alcance de cada lado. */
  capas_antes: string[];
  capas_depois: string[];
  /** media_id → caminho da capa no bucket. */
  capas?: Record<string, string>;
}

export interface MetaNumeros {
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  vendas: number;
  faturamento: number;
  /** Visualizações de vídeo (3 segundos ou mais). */
  visualizacoes: number;
  /** Conversas iniciadas por mensagem (WhatsApp, Direct, Messenger). Opcional nos relatórios antigos. */
  conversas?: number;
}

export interface TarefaClickup {
  nome: string;
  lista: string;
  status: string;
  /** Prazo (YYYY-MM-DD, Brasília). */
  prazo: string | null;
}

export interface TrabalhoPeriodo {
  feitas: TarefaClickup[];
  /** Em andamento e próximas: como estavam no momento em que o relatório foi gerado. */
  andamento: TarefaClickup[];
  proximas: TarefaClickup[];
  /** O que ficou pronto, por tipo ("8 vídeos editados"). */
  producao: { rotulo: string; total: number }[];
  /** Quando as tarefas foram lidas (ISO). */
  em: string;
}

export interface Destaque {
  titulo: string;
  texto: string;
}

export interface TextosSemana {
  titulo: string;
  resumo: string;
  destaques: Destaque[];
  proximos: string[];
  /** O que funcionou e o que ajustar, já interpretado (uma frase cada). */
  funcionou?: string[];
  ajustar?: string[];
  /** O trabalho da Mantora, em frases para o cliente (a partir do ClickUp). */
  feito?: string[];
  andamento?: string[];
  /** "Palavras que aqueceram o coração": comentários escolhidos (sem nome de quem escreveu). */
  palavras?: string[];
}

export interface TrafegoSemana {
  investimento?: number | null;
  leads?: number | null;
  cpl?: number | null;
  vendas?: number | null;
  faturamento?: number | null;
  roas?: number | null;
  /** Secundários: só aparecem em "Todos os números". */
  impressoes?: number | null;
  cliques?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  /** Custo por visualização (vídeo). */
  cpv?: number | null;
  /** Conversas iniciadas por mensagem pelos anúncios. */
  conversas?: number | null;
  observacao?: string | null;
}

export type SecaoId =
  | "numeros"
  | "momentos"
  | "destaques"
  | "conteudos"
  | "funcionou"
  | "grafico"
  | "leads"
  | "trafego"
  | "entregas"
  | "proximos"
  | "detalhes"
  | "publico"
  | "pendencias"
  | "palavras"
  | "nicho";

export interface RelatorioSemana {
  id: string;
  cliente_slug: string;
  tipo: TipoPeriodo;
  semana_inicio: string;
  semana_fim: string;
  status: "rascunho" | "publicado";
  dados: DadosSemana;
  textos: TextosSemana;
  trafego: TrafegoSemana;
  entregas: string[];
  secoes: Partial<Record<SecaoId, boolean>>;
  notas: string | null;
  publicado_em: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
  visualizacoes: number;
}

/** O que a página do relatório recebe (link do cliente ou prévia da equipe). */
export interface RelatorioView {
  cliente: { nome: string; foto: string | null; tema?: Tema | null };
  /** `trafego` já vem com os números do Meta e o que a equipe digitou por cima; `trafego_anterior`, o período anterior no Meta. */
  semana: Pick<RelatorioSemana, "tipo" | "semana_inicio" | "semana_fim" | "dados" | "textos" | "trafego" | "entregas" | "secoes"> & {
    trafego_anterior?: Partial<Record<keyof TrafegoSemana, number | null>>;
  };
  /** URLs assinadas das capas (caminho no bucket → URL). */
  capas: Record<string, string>;
  /** Períodos publicados, para o seletor do link do cliente. */
  semanas?: CardPeriodo[];
}

/** Um relatório publicado, para os cards "Seus relatórios" do link do cliente. */
export interface CardPeriodo {
  tipo: TipoPeriodo;
  inicio: string;
  fim: string;
  titulo?: string;
  /** O cliente já abriu. */
  visto?: boolean;
  numeros?: { rotulo: string; valor: number; formato?: "inteiro" | "moeda" | "pct" }[];
}

/** Cores do relatório do cliente (a partir do estilo padrão, do kit de marca ou escolhidas pela equipe). */
export interface Tema {
  /** Fundo escuro (capa, tráfego, retrospectiva). */
  escuro: string;
  /** Cor de destaque (números, barras, botões). */
  destaque: string;
  /** De onde veio: estilo, kit ou equipe. */
  origem?: string;
}
