import type { InventoryPal } from "./planner";

const SESSION_KEY = "palworld-supabase-session-v1";

export type UserSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string };
};

export type SaveProfile = {
  world_id: string;
  name: string;
  source_file_name: string | null;
  source_file_modified_at: string | null;
  updated_at: string;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("缺少 Supabase 公共配置");
  return { url, key };
}

function storeSession(session: UserSession | null) {
  if (typeof localStorage === "undefined") return;
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export function readStoredSession(): UserSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as UserSession : null;
  } catch {
    return null;
  }
}

async function authRequest(path: string, body: Record<string, string>): Promise<UserSession> {
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as UserSession & { msg?: string; error_description?: string };
  if (!response.ok) throw new Error(payload.msg || payload.error_description || "登录失败");
  if (!payload.access_token) throw new Error("请先完成邮箱确认，再返回登录");
  storeSession(payload);
  return payload;
}

export const signInUser = (email: string, password: string) =>
  authRequest("token?grant_type=password", { email, password });

export const signUpUser = (email: string, password: string) =>
  authRequest("signup", { email, password });

export async function signOutUser(session: UserSession | null) {
  storeSession(null);
  if (!session) return;
  const { url, key } = config();
  await fetch(`${url}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
  }).catch(() => undefined);
}

async function validSession(session: UserSession): Promise<UserSession> {
  if (!session.expires_at || session.expires_at * 1000 > Date.now() + 60_000) return session;
  const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
  return refreshed;
}

async function userRequest(session: UserSession, path: string, init: RequestInit = {}) {
  const active = await validSession(session);
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${active.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message.slice(0, 300) || `数据库请求失败 (${response.status})`);
  }
  return response;
}

export async function listSaveProfiles(session: UserSession): Promise<SaveProfile[]> {
  const response = await userRequest(session, "user_worlds?select=world_id,name,source_file_name,source_file_modified_at,updated_at&order=updated_at.desc");
  return response.json();
}

export async function loadProfileInventory(session: UserSession, worldId: string): Promise<InventoryPal[]> {
  const response = await userRequest(session, `user_pal_inventory?select=*&world_id=eq.${encodeURIComponent(worldId)}&order=imported_at.asc`);
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.user_pal_id),
    palId: String(row.pal_id),
    sex: row.sex === "M" ? "M" : "F",
    nickname: String(row.nickname ?? ""),
    passives: Array.isArray(row.passive_names_zh) ? row.passive_names_zh.map(String) : [],
    hp: row.hp_iv == null ? null : Number(row.hp_iv),
    attack: row.attack_iv == null ? null : Number(row.attack_iv),
    defense: row.defense_iv == null ? null : Number(row.defense_iv),
  }));
}

export async function replaceProfileInventory(
  session: UserSession,
  profile: { worldId?: string; name: string; sourceFileName?: string },
  inventory: InventoryPal[],
): Promise<string> {
  const response = await userRequest(session, "rpc/replace_user_world_inventory", {
    method: "POST",
    body: JSON.stringify({
      p_world_id: profile.worldId || null,
      p_world_name: profile.name,
      p_source_file_name: profile.sourceFileName || null,
      p_items: inventory.map((item) => ({
        id: item.id,
        pal_id: item.palId,
        sex: item.sex,
        nickname: item.nickname ?? "",
        hp: item.hp ?? null,
        attack: item.attack ?? null,
        defense: item.defense ?? null,
        passives: item.passives,
      })),
    }),
  });
  return response.json();
}
