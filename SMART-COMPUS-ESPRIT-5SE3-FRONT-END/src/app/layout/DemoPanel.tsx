import { useNavigate } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAuth } from "@/shared/auth/AuthContext";
import { ROLES, ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { MODULES } from "@/app/modules";
import { serviceHealth, useDownServices } from "@/shared/services/serviceHealth";
import { useT } from "@/shared/i18n";

/** Panneau de démo : changer de rôle, simuler une panne par module, voir les pages d'erreur. */
export function DemoPanel() {
  const t = useT();
  const navigate = useNavigate();
  const { role, setRole } = useAuth();
  const down = useDownServices();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100"
          aria-label={t("demo.title")}
        >
          <FlaskConical aria-hidden="true" />
          <span className="hidden xl:inline">{t("demo.title")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t("demo.role")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
          {ROLES.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {t(ROLE_LABEL[r])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("demo.outages")}</DropdownMenuLabel>
        {MODULES.map((m) => (
          <DropdownMenuCheckboxItem
            key={m.id}
            checked={down.has(m.id)}
            onCheckedChange={() => serviceHealth.toggle(m.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {t(m.labelKey)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("demo.errors")}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate("/demo/403")}>{t("demo.error403")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/demo/409")}>{t("demo.error409")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/demo/composants")}>{t("demo.components")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => serviceHealth.reset()}>{t("demo.reset")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
