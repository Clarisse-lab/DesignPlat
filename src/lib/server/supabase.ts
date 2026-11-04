import "server-only";
// Acesso ao Supabase do Escritório (projeto Agência Mantora) sem SDK: REST, Auth e funções.
// O mesmo projeto guarda a equipe (login), os kits de marca e o custo das IAs (uso_ia).
// Variáveis no Railway: SUPABASE_URL, SUPABASE_ANON_KEY (publishable) e SUPABASE_SERVICE_ROLE_KEY.

const clean = (value: string | undefined) => (value ?? "").trim().replace(/^[<"']+|[>"']+$/g, "").replace(/\/+$/, "");

export const SUPABASE_URL = clean(process.env.SUPABASE_URL);
export const SUPABASE_ANON_KEY = clean(process.env.SUPABASE_ANON_KEY);
const SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Login ligado quando o Supabase está configurado. Sem ele, o site funciona aberto, como antes. */
export const supabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_KEY);

function serviceHeaders(extra?: HeadersInit): HeadersInit {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra };
}

/** Chamada ao PostgREST com a chave de serviço (só no servidor). */
export async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: serviceHeaders(init.headers),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return rest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

/** Chama uma função do Supabase protegida pelo segredo interno (o mesmo do coletor). */
export async function callFunction<T>(name: string, query: string, body: unknown = {}): Promise<T> {
  const secret = await rpc<string>("coletor_secret");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}${query}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "x-coletor-secret": secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.erro ?? data?.error ?? `função ${name} respondeu ${response.status}`);
  return data as T;
}

export interface TeamMember {
  email: string;
  nome: string;
  admin: boolean;
}

/** Confere o token do login Google (Supabase Auth) e se a pessoa está ativa na tabela `equipe`. */
export async function memberFromToken(token: string): Promise<TeamMember | "invalid" | "forbidden"> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    cache: "no-store",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return "invalid";
  const user = (await response.json()) as { email?: string };
  const email = user.email?.toLowerCase();
  if (!email) return "invalid";
  const rows = await rest<{ email: string; nome: string; admin: boolean; ativo: boolean }[]>(
    `equipe?select=email,nome,admin,ativo&email=eq.${encodeURIComponent(email)}`,
  );
  const member = rows[0];
  if (!member?.ativo) return "forbidden";
  return { email: member.email, nome: member.nome, admin: member.admin };
}
