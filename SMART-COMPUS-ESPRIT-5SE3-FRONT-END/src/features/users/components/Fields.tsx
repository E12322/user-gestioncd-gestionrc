import type { InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  error?: ReactNode;
  hint?: string;
  trailing?: ReactNode;
}

/** Champ de formulaire : label lié, erreur inline reliée par aria-describedby, aria-invalid. */
export function TextField({ id, label, error, hint, trailing, className, required, ...props }: TextFieldProps) {
  const t = useT();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-700">
            *
          </span>
        )}
        {required && <span className="sr-only"> ({t("users.required")})</span>}
      </label>
      <div className="relative">
        <Input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(error && "border-red-600", trailing && "pr-11", className)}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

interface RoleSelectProps {
  id: string;
  label: string;
  value: Role | "";
  onChange: (role: Role) => void;
  roles: readonly Role[];
  disabled?: boolean;
  /** Masque le label visuellement (usage dans un tableau). */
  hideLabel?: boolean;
  className?: string;
}

export function RoleSelect({ id, label, value, onChange, roles, disabled, hideLabel, className }: RoleSelectProps) {
  const t = useT();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium", hideLabel && "sr-only")}>
        {label}
      </label>
      <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Role)}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {t(ROLE_LABEL[r])}
          </option>
        ))}
      </Select>
    </div>
  );
}
