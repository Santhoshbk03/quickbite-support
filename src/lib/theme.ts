import { createPreference, usePreference } from "./preferences";
import { THEME_STORAGE_KEY } from "./theme-script";

export type Theme = "dark" | "light";

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

const themePreference = createPreference<Theme>(THEME_STORAGE_KEY, "dark", ["dark", "light"], {
  onChange: applyTheme,
});

export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const [theme, setTheme] = usePreference(themePreference);
  return { theme, setTheme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") };
}
