"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  ["/", "Ferramentas"],
  ["/tweet", "Carrossel Tweet"],
  ["/feed", "Post de Feed"],
  ["/story", "Story"],
  ["/apresentacao", "Apresentação"],
  ["/desempenho", "Desempenho"],
  ["/relatorios", "Relatórios"],
];

export function AppHeader() {
  const pathname = usePathname();
  // Link de aprovação: o cliente vê só a marca, sem o menu das ferramentas da equipe.
  const isClient = ["/aprovar", "/privacidade", "/termos"].some((p) => pathname?.startsWith(p));
  // Relatório semanal do cliente: a página tem cabeçalho próprio.
  if (pathname?.startsWith("/r/")) return null;
  return (
    <header className="mantora-header">
      <Link href="/" className="mantora-brand" aria-label="Design Mantora — início">
        <span>mantora<sup>®</sup></span><small>design</small>
      </Link>
      {!isClient && <nav className="mantora-nav" aria-label="Ferramentas de criação">
        {links.map(([href, label]) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>}
      <ThemeToggle />
    </header>
  );
}
