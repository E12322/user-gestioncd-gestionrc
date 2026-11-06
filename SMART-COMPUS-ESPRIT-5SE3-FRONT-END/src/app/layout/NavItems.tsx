import { NavLink } from "react-router-dom";
import { Home } from "lucide-react";
import { useAuth } from "@/shared/auth/AuthContext";
import { modulesForRole } from "@/app/modules";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

/** Liste de navigation partagée par la barre latérale et le tiroir mobile. */
export function NavItems({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const t = useT();
  const { role } = useAuth();
  const items = [
    { to: "/", label: t("nav.home"), Icon: Home, end: true },
    ...modulesForRole(role).map((m) => ({ to: m.path, label: t(m.labelKey), Icon: m.icon, end: false })),
  ];

  return (
    <ul className="space-y-1">
      {items.map(({ to, label, Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive ? "bg-navy text-white" : "text-slate-700 hover:bg-secondary",
              )
            }
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
