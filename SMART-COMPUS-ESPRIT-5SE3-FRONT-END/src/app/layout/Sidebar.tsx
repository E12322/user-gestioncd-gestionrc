import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { NavItems } from "./NavItems";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <aside
      className={cn(
        "sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col border-r bg-card p-3 transition-[width] duration-200 lg:flex",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <nav aria-label={t("nav.main")} className="flex-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("nav.modules")}</p>
        )}
        <NavItems collapsed={collapsed} />
      </nav>
      <Button
        variant="ghost"
        size={collapsed ? "icon" : "sm"}
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
        title={collapsed ? t("nav.expand") : undefined}
        className={cn("mt-2 text-muted-foreground", collapsed ? "mx-auto" : "justify-start")}
      >
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        {!collapsed && t("nav.collapse")}
      </Button>
    </aside>
  );
}
