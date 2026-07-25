import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CHUNK_SIZE = 1800;

/**
 * SecureStore adapter with chunking — Expo SecureStore has a ~2KB value limit,
 * while Supabase session JSON is often larger.
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }

    const chunkCountRaw = await SecureStore.getItemAsync(`${key}.__chunks`);
    if (!chunkCountRaw) {
      return SecureStore.getItemAsync(key);
    }

    const chunkCount = Number(chunkCountRaw);
    if (!Number.isFinite(chunkCount) || chunkCount <= 0) return null;

    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // ignore quota errors in web preview
      }
      return;
    }

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}.__chunks`).catch(() => undefined);
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}.__chunks`, String(chunkCount));
    await SecureStore.deleteItemAsync(key).catch(() => undefined);

    for (let i = 0; i < chunkCount; i += 1) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}.${i}`, chunk);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
      return;
    }

    const chunkCountRaw = await SecureStore.getItemAsync(`${key}.__chunks`);
    if (chunkCountRaw) {
      const chunkCount = Number(chunkCountRaw);
      for (let i = 0; i < chunkCount; i += 1) {
        await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => undefined);
      }
      await SecureStore.deleteItemAsync(`${key}.__chunks`).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  },
};
