"use client";

// Painel "Cliente": escolhe um cliente da Mantora e aplica o kit de marca confirmado no Escritório
// (logo, nome, @, paleta, fonte, alinhamento…). Some quando o login não está configurado.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { FeedBrand, FeedStyle } from "@/lib/templates/feed";
import { inputClass, Panel } from "./ui";

export interface StudioClient {
  slug: string;
  nome: string;
  kit: { status: "sugerido" | "confirmado"; marca: FeedBrand; estilo: Partial<FeedStyle>; layouts: string[] } | null;
}

/** null enquanto carrega; [] quando o login está desligado ou deu erro. */
export function useStudioClients() {
  const [clients, setClients] = useState<StudioClient[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/estudio/clientes")
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        setEnabled(r.ok);
        setClients(r.ok ? data.clientes : []);
      })
      .catch(() => !cancelled && setClients([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return { clients, enabled };
}

export function ClientPanel({
  clients,
  value,
  onSelect,
}: {
  clients: StudioClient[] | null;
  value: string | null;
  onSelect: (client: StudioClient | null) => void;
}) {
  const current = clients?.find((c) => c.slug === value) ?? null;
  return (
    <Panel title="Cliente">
      {clients === null ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando clientes…
        </p>
      ) : (
        <div className="space-y-2">
          <select
            value={value ?? ""}
            onChange={(e) => onSelect(clients.find((c) => c.slug === e.target.value) ?? null)}
            className={inputClass}
          >
            <option value="">Sem cliente</option>
            {clients.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nome}
                {c.kit ? (c.kit.status === "confirmado" ? " · kit confirmado" : " · kit sugerido") : ""}
              </option>
            ))}
          </select>
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            {current
              ? current.kit
                ? "Kit de marca aplicado. Ajustes feitos aqui valem só para esta peça; o kit se muda na aba Identidade visual do Escritório."
                : "Este cliente ainda não tem kit de marca. Leia a identidade na aba Identidade visual do Escritório."
              : "Escolha o cliente para aplicar o kit de marca, usar as fotos dele e gerar imagens com o rosto dele."}
          </p>
        </div>
      )}
    </Panel>
  );
}
