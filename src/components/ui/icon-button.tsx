"use client";

import { Button } from "./button";
import type { ButtonProps } from "./button";
import { Tooltip } from "./tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "size"> {
  /** Accessible name, also shown as the tooltip. Icon-only buttons must always have one. */
  label: string;
  icon: React.ReactNode;
  size?: "icon" | "icon-sm";
  shortcut?: React.ReactNode;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

export function IconButton({
  label,
  icon,
  size = "icon-sm",
  variant = "ghost",
  shortcut,
  tooltipSide = "bottom",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip
      side={tooltipSide}
      content={
        <span className="inline-flex items-center gap-2">
          {label}
          {shortcut}
        </span>
      }
    >
      <Button aria-label={label} size={size} variant={variant} {...props}>
        {icon}
      </Button>
    </Tooltip>
  );
}
