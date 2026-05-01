import { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "./domain";

export type Variant = "signal" | "council" | "atlas";
export type Theme = "light" | "dark";

const DEFAULT_THEME: Record<Variant, Theme> = {
  signal: "dark",
  council: "dark",
  atlas: "light",
};

type AppCtx = {
  variant: Variant;
  setVariant: (v: Variant) => void;
  role: Role;
  setRole: (r: Role) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const Ctx = createContext<AppCtx | null>(null);

function loadTheme(variant: Variant): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME[variant];
  return (localStorage.getItem(`theme:${variant}`) as Theme) || DEFAULT_THEME[variant];
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [variant, setVariantState] = useState<Variant>(() => {
    if (typeof window === "undefined") return "council";
    return (localStorage.getItem("variant") as Variant) || "council";
  });
  const [role, setRoleState] = useState<Role>(() => {
    if (typeof window === "undefined") return "reviewer";
    return (localStorage.getItem("role") as Role) || "reviewer";
  });
  const [theme, setThemeState] = useState<Theme>(() => loadTheme(variant));

  useEffect(() => {
    document.documentElement.dataset.variant = variant;
    document.documentElement.dataset.theme = loadTheme(variant);
    setThemeState(loadTheme(variant));
  }, [variant]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setVariant = (v: Variant) => {
    setVariantState(v);
    localStorage.setItem("variant", v);
  };
  const setRole = (r: Role) => {
    setRoleState(r);
    localStorage.setItem("role", r);
  };
  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(`theme:${variant}`, t);
  };
  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <Ctx.Provider value={{ variant, setVariant, role, setRole, theme, setTheme, toggleTheme }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppStateProvider missing");
  return c;
}
