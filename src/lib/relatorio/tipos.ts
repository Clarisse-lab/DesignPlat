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
    acima?: string[];
    abaixo?: string[];
  } | null;
  /** Recordes e comparações com o normal do perfil, calculados pelo sistema. */
  marcos?: Marco[];
  leads: { total: Kpi; origens: { origem: string; total: number }[] } | null;
  /** Entregas que o sistema vê sozinho (peças aprovadas pelo cliente no link de aprovação). */
  aprovadas: { titulo: string; em: string }[];
  /** Trabalho da Mantora no ClickUp. As listas de tarefas são internas (o link do cliente só recebe a contagem). */
  trabalho?: TrabalhoPeriodo | null;
  foto_perfil: string | null;
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
  | "detalhes";

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
  cliente: { nome: string; foto: string | null };
  semana: Pick<RelatorioSemana, "tipo" | "semana_inicio" | "semana_fim" | "dados" | "textos" | "trafego" | "entregas" | "secoes">;
  /** URLs assinadas das capas (caminho no bucket → URL). */
  capas: Record<string, string>;
  /** Períodos publicados, para o seletor do link do cliente. */
  semanas?: { tipo: TipoPeriodo; inicio: string; fim: string }[];
}
