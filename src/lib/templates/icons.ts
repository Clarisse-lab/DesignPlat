// Ícones disponíveis nos templates (Lucide, licença ISC), em SVG puro.

import {
  Award,
  BookOpen,
  Brain,
  Briefcase,
  Calendar,
  Camera,
  Check,
  ChartColumn,
  CircleCheck,
  Clock,
  Coffee,
  Crown,
  Flame,
  Gift,
  GraduationCap,
  Heart,
  Leaf,
  Lightbulb,
  MapPin,
  Megaphone,
  MessageCircle,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-static";

export const ICONS = {
  ideia: { label: "Ideia", svg: Lightbulb },
  alvo: { label: "Alvo", svg: Target },
  crescimento: { label: "Crescimento", svg: TrendingUp },
  grafico: { label: "Gráfico", svg: ChartColumn },
  foguete: { label: "Foguete", svg: Rocket },
  raio: { label: "Raio", svg: Zap },
  brilho: { label: "Brilho", svg: Sparkles },
  estrela: { label: "Estrela", svg: Star },
  coracao: { label: "Coração", svg: Heart },
  check: { label: "Check", svg: CircleCheck },
  joinha: { label: "Joinha", svg: ThumbsUp },
  sorriso: { label: "Sorriso", svg: Smile },
  pessoas: { label: "Pessoas", svg: Users },
  conversa: { label: "Conversa", svg: MessageCircle },
  megafone: { label: "Megafone", svg: Megaphone },
  calendario: { label: "Calendário", svg: Calendar },
  relogio: { label: "Relógio", svg: Clock },
  sacola: { label: "Sacola", svg: ShoppingBag },
  carteira: { label: "Carteira", svg: Wallet },
  maleta: { label: "Maleta", svg: Briefcase },
  camera: { label: "Câmera", svg: Camera },
  livro: { label: "Livro", svg: BookOpen },
  formatura: { label: "Formatura", svg: GraduationCap },
  cerebro: { label: "Cérebro", svg: Brain },
  escudo: { label: "Escudo", svg: ShieldCheck },
  premio: { label: "Prêmio", svg: Award },
  coroa: { label: "Coroa", svg: Crown },
  fogo: { label: "Fogo", svg: Flame },
  presente: { label: "Presente", svg: Gift },
  folha: { label: "Folha", svg: Leaf },
  cafe: { label: "Café", svg: Coffee },
  local: { label: "Local", svg: MapPin },
} as const;

export type IconId = keyof typeof ICONS;
export const ICON_IDS = Object.keys(ICONS) as IconId[];

// Ícones de apoio usados pelos próprios layouts (não aparecem na lista de escolha).
export const MARK_ICONS = { yes: Check, no: X } as const;

function withClass(svg: string, className: string): string {
  return svg.replace(/class="[^"]*"/, `class="${className}"`).replace(/\s+/g, " ").trim();
}

/** SVG do ícone com a classe indicada (o tamanho e a cor vêm do CSS do template). */
export function iconSvg(id: string | null | undefined, className: string): string {
  if (!id || !(id in ICONS)) return "";
  return withClass(ICONS[id as IconId].svg, className);
}

export function markSvg(kind: keyof typeof MARK_ICONS, className: string): string {
  return withClass(MARK_ICONS[kind], className);
}
