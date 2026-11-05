import type { Metadata } from "next";
import { AppHeader } from "@/components/appearance/AppHeader";
import { themeInitializer } from "@/components/appearance/initialize";
import { AuthGate } from "@/components/auth/AuthGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Mantora",
  description: "Criação de carrosséis, posts, stories e apresentações a partir de texto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitializer }} /></head>
      <body className="min-h-screen font-sans antialiased">
        <AppHeader />
        <main className="mantora-workspace">
          <AuthGate>{children}</AuthGate>
        </main>
      </body>
    </html>
  );
}
