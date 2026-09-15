"use client";

import { Moon, Sun } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <IconButton
      label={`Switch to ${next} theme`}
      icon={theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
      onClick={toggleTheme}
    />
  );
}
