import { z } from "zod";

export function readStorage<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : fallback;
  } catch { return fallback; }
}

export function writeStorage(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function readPreference(key: string, fallback: string): string {
  try { const value = localStorage.getItem(key); if (value === null) return fallback; try { const decoded: unknown = JSON.parse(value); return typeof decoded === "string" ? decoded : value; } catch { return value; } } catch { return fallback; }
}

export function writePreference(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
