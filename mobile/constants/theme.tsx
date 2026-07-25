import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, useColorScheme, type TextStyle, type ViewStyle } from "react-native";

export const palette = {
  blue: "#1d4ed8",
  blueSoft: "#dbeafe",
  cyan: "#0891b2",
  coral: "#e11d48",
  amber: "#d97706",
  white: "#ffffff",
  black: "#020617",
} as const;

export const colors = {
  light: {
    background: "#f4f7fb",
    foreground: "#0f172a",
    card: "#ffffff",
    cardElevated: "#ffffff",
    primary: palette.blue,
    primarySoft: palette.blueSoft,
    primaryForeground: "#f8fafc",
    muted: "#e8eef6",
    mutedForeground: "#64748b",
    border: "#d7e0ec",
    destructive: palette.coral,
    success: "#059669",
    bubbleMe: "#1d4ed8",
    bubbleThem: "#ffffff",
    tabBar: "#ffffff",
    overlay: "rgba(15, 23, 42, 0.45)",
  },
  dark: {
    background: "#070b14",
    foreground: "#e2e8f0",
    card: "#111827",
    cardElevated: "#152033",
    primary: "#60a5fa",
    primarySoft: "#1e3a5f",
    primaryForeground: "#0b1220",
    muted: "#1a2436",
    mutedForeground: "#94a3b8",
    border: "#243044",
    destructive: "#fb7185",
    success: "#34d399",
    bubbleMe: "#2563eb",
    bubbleThem: "#152033",
    tabBar: "#0c1220",
    overlay: "rgba(0, 0, 0, 0.55)",
  },
} as const;

export type ThemeColors = (typeof colors)["light"];
export type ThemeMode = "light" | "dark";

const THEME_KEY = "teamsync.themeMode";

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  c: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "light" || stored === "dark") {
        setModeState(stored);
        Appearance.setColorScheme(stored);
      } else {
        setModeState("light");
        Appearance.setColorScheme("light");
      }
      setReady(true);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    Appearance.setColorScheme(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = ready ? mode : "light";
    const isDark = resolved === "dark";
    return {
      mode: resolved,
      isDark,
      c: (isDark ? colors.dark : colors.light) as ThemeColors,
      setMode,
      toggle,
    };
  }, [mode, ready, setMode, toggle]);

  // Keep in sync if OS scheme changes while we force Appearance — prefer stored mode
  useEffect(() => {
    if (!ready) return;
    if (system && system !== mode) {
      // Appearance.setColorScheme should drive system; ignore drift
    }
  }, [system, mode, ready]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: "light" as ThemeMode,
      isDark: false,
      c: colors.light,
      setMode: () => undefined,
      toggle: () => undefined,
    };
  }
  return ctx;
}

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  brand: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  } satisfies TextStyle,
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
  } satisfies TextStyle,
  heading: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    fontWeight: "400",
  } satisfies TextStyle,
  bodyMedium: {
    fontSize: 15,
    fontWeight: "500",
  } satisfies TextStyle,
  caption: {
    fontSize: 13,
    fontWeight: "400",
  } satisfies TextStyle,
  label: {
    fontSize: 12,
    fontWeight: "600",
  } satisfies TextStyle,
};

export const shadow = {
  card: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  } satisfies ViewStyle,
};

export const ACTIVE_WORKSPACE_KEY = "teamsync.activeWorkspaceId";
