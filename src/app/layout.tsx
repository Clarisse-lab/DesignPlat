import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DesignPlat",
  description: "Criação de carrosséis, posts, stories e apresentações a partir de texto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-[13px] text-white">D</span>
              DesignPlat
            </Link>
            <nav className="flex items-center gap-1 text-[13px] font-medium text-ink-soft">
              <Link href="/tweet" className="rounded-md px-3 py-1.5 hover:bg-canvas hover:text-ink">
                Carrossel Tweet
              </Link>
              <Link href="/feed" className="rounded-md px-3 py-1.5 hover:bg-canvas hover:text-ink">
                Post de Feed
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
