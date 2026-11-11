// Relatório semanal do cliente: formato dos dados (servidor, aba Relatórios e link do cliente).

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
  } | null;
  leads: { total: Kpi; origens: { origem: string; total: number }[] } | null;
  /** Entregas que o sistema vê sozinho (peças aprovadas pelo cliente no link de aprovação). */
  aprovadas: { titulo: string; em: string }[];
  foto_perfil: string | null;
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
}

export interface TrafegoSemana {
  investimento?: number | null;
  leads?: number | null;
  cpl?: number | null;
  vendas?: number | null;
  faturamento?: number | null;
  roas?: number | null;
  observacao?: string | null;
}

export type SecaoId = "numeros" | "destaques" | "conteudos" | "grafico" | "leads" | "trafego" | "entregas" | "proximos";

export interface RelatorioSemana {
  id: string;
  cliente_slug: string;
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
  semana: Pick<RelatorioSemana, "semana_inicio" | "semana_fim" | "dados" | "textos" | "trafego" | "entregas" | "secoes">;
  /** URLs assinadas das capas (caminho no bucket → URL). */
  capas: Record<string, string>;
  /** Semanas publicadas, para o seletor do link do cliente. */
  semanas?: { inicio: string; fim: string }[];
}
