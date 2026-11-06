import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** Interrupteur accessible (role="switch", Espace/Entrée). Fournir `aria-label`. */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ className, checked, onCheckedChange, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-primary" : "bg-slate-300",
      className,
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className={cn("block size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0")}
    />
  </button>
));
Switch.displayName = "Switch";
