import type { InventoryPal } from "./planner";

export type SharedSaveUser = {
  user_id: string;
  name: string;
  source_file_name: string | null;
  updated_at: string;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("缺少 Supabase 公共配置");
  return { url, key };
}

async function publicRequest(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

export async function listSharedSaveUsers(): Promise<SharedSaveUser[]> {
  const response = await publicRequest("shared_save_users?select=user_id,name,source_file_name,updated_at&order=updated_at.desc");
  return response.json();
}

export async function loadSharedUserInventory(userId: string): Promise<InventoryPal[]> {
  const columns = "user_pal_id,pal_id,sex,nickname,hp_iv,attack_iv,defense_iv,passive_names_zh";
  const response = await publicRequest(`shared_user_inventory?select=${columns}&user_id=eq.${encodeURIComponent(userId)}&order=imported_at.asc`);
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

export async function replaceSharedUserInventory(
  user: { userId?: string; name: string; sourceFileName?: string },
  inventory: InventoryPal[],
): Promise<string> {
  const response = await publicRequest("rpc/replace_shared_user_inventory", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: user.userId || null,
      p_user_name: user.name,
      p_source_file_name: user.sourceFileName || null,
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
