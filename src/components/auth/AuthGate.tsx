"use client";

// Login da equipe com o Google (Supabase Auth, o mesmo do Escritório).
// Depois de entrar, todo fetch para /api/ deste site leva o token automaticamente.
// A página interna /interno/* (usada pelo próprio servidor), o link de aprovação /aprovar/* e o relatório
// semanal do cliente /r/* não passam por aqui.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut } from "lucide-react";

interface SupabaseSession {
  access_token: string;
}
interface SupabaseClient {
  auth: {
    getSession: () => Promise<{ data: { session: SupabaseSession | null } }>;
    onAuthStateChange: (cb: (event: string, session: SupabaseSession | null) => void) => void;
    signInWithOAuth: (options: { provider: "google"; options: { redirectTo: string; queryParams?: Record<string, string> } }) => Promise<unknown>;
    signOut: () => Promise<unknown>;
  };
}
declare global {
  interface Window {
    supabase?: { createClient: (url: string, key: string, options: unknown) => SupabaseClient };
  }
}

type GateState =
  | { kind: "loading" }
  | { kind: "open" }
  | { kind: "login"; error?: string }
  | { kind: "in"; nome: string };

const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

function loadSdk(): Promise<void> {
  if (window.supabase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Não foi possível carregar o login (supabase-js)."));
    document.head.appendChild(script);
  });
}

let currentToken: string | null = null;
let fetchPatched = false;

/** Acrescenta o token em todo fetch para /api/ do próprio site (sem mudar cada chamada do editor). */
function patchFetch() {
  if (fetchPatched) return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const sameOriginApi = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
    if (!sameOriginApi || !currentToken) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("authorization")) headers.set("authorization", `Bearer ${currentToken}`);
    return original(input, { ...init, headers });
  };
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // /interno: usada pelo servidor; /aprovar, /r, /privacidade e /termos: páginas abertas (sem login).
  const internal = ["/interno", "/aprovar", "/privacidade", "/termos", "/r/"].some((p) => pathname?.startsWith(p));
  const [state, setState] = useState<GateState>({ kind: "loading" });
  const client = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (internal) return;
    let cancelled = false;
    (async () => {
      try {
        const config = await (await fetch("/api/config")).json();
        if (!config.login) {
          if (!cancelled) setState({ kind: "open" });
          return;
        }
        await loadSdk();
        const supabase = window.supabase!.createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true, flowType: "implicit" },
        });
        client.current = supabase;
        patchFetch();
        supabase.auth.onAuthStateChange((_event, session) => {
          currentToken = session?.access_token ?? null;
        });
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) setState({ kind: "login" });
          return;
        }
        currentToken = data.session.access_token;
        if (window.location.hash.includes("access_token")) history.replaceState(null, "", window.location.pathname + window.location.search);
        const response = await fetch("/api/sessao");
        const body = await response.json().catch(() => ({}));
        if (!cancelled) setState(response.ok ? { kind: "in", nome: body.nome } : { kind: "login", error: body.error ?? "Não foi possível entrar." });
      } catch (error) {
        if (!cancelled) setState({ kind: "login", error: error instanceof Error ? error.message : "Erro no login." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [internal]);

  if (internal || state.kind === "open") return <>{children}</>;

  if (state.kind === "loading") {
    return (
      <div className="grid min-h-[60vh] place-items-center text-ink-soft">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (state.kind === "login") {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-6">
          <h1 className="text-xl font-bold tracking-tight">Entrar no Design Mantora</h1>
          {state.error ? (
            <p className="rounded-lg bg-orange-50 px-3 py-2 text-[13px] text-danger">{state.error}</p>
          ) : (
            <p className="text-[13px] text-ink-soft">Use a conta Google liberada no Escritório da Mantora.</p>
          )}
          <button
            type="button"
            onClick={() =>
              client.current?.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: "select_account" } },
              })
            }
            className="w-full rounded-lg bg-ink px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-ink/90"
          >
            Entrar com Google
          </button>
          {state.error && (
            <button
              type="button"
              onClick={async () => {
                await client.current?.auth.signOut();
                window.location.reload();
              }}
              className="w-full rounded-lg border border-line px-4 py-2 text-[13px] text-ink-soft hover:text-ink"
            >
              Usar outra conta
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <div className="fixed bottom-3 left-3 z-40 flex items-center gap-2 rounded-full border border-line bg-surface/95 py-1 pl-3 pr-1 text-[12px] text-ink-soft shadow-sm">
        {state.nome}
        <button
          type="button"
          title="Sair"
          aria-label="Sair"
          onClick={async () => {
            await client.current?.auth.signOut();
            window.location.reload();
          }}
          className="grid h-7 w-7 place-items-center rounded-full hover:bg-canvas hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}
