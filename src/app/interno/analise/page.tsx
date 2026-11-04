import type { Metadata } from "next";
import { AnalysisBridge } from "@/components/analysis/AnalysisBridge";

export const metadata: Metadata = { title: "Análise · Design Mantora", robots: { index: false, follow: false } };

/**
 * Página interna usada pelo próprio servidor (Chromium) para ler a identidade de vários posts
 * com o mesmo código do "Inspirar" do editor. Não aparece no menu e não faz nada sozinha.
 */
export default function AnalysisPage() {
  return <AnalysisBridge />;
}
