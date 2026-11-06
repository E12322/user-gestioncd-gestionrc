import { NavLink } from "react-router-dom";
import { Home, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/components/ui/sheet";
import { Logo } from "@/shared/components/Logo";
import { NavItems } from "./NavItems";
import { useAuth } from "@/shared/auth/AuthContext";
import { modulesForRole } from "@/app/modules";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

const tab = "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium";

/** Barre d'onglets inférieure (mobile/tablette) : Accueil + 3 premiers modules + « Menu » (tiroir complet). */
export function MobileNav({ drawerOpen, onDrawerChange }: { drawerOpen: boolean; onDrawerChange: (open: boolean) => void }) {
  const t = useT();
  const { role } = useAuth();
  const tabs = modulesForRole(role).slice(0, 3);

  return (
    <>
      <nav
        aria-label={t("nav.mobile")}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavLink to="/" end className={({ isActive }) => cn(tab, isActive ? "text-navy" : "text-slate-600")}>
          <Home className="size-5" aria-hidden="true" />
          {t("nav.home")}
        </NavLink>
        {tabs.map((m) => (
          <NavLink key={m.id} to={m.path} className={({ isActive }) => cn(tab, isActive ? "text-navy" : "text-slate-600")}>
            <m.icon className="size-5" aria-hidden="true" />
            <span className="max-w-full truncate">{t(m.shortLabelKey)}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => onDrawerChange(true)} className={cn(tab, "text-slate-600")} aria-haspopup="dialog">
          <Menu className="size-5" aria-hidden="true" />
          {t("nav.menu")}
        </button>
      </nav>

      <Sheet open={drawerOpen} onOpenChange={onDrawerChange}>
        <SheetContent>
          <SheetTitle className="sr-only">{t("nav.menu")}</SheetTitle>
          <div className="mb-6 mt-1">
            <Logo />
          </div>
          <nav aria-label={t("nav.main")} className="flex-1 overflow-y-auto">
            <NavItems onNavigate={() => onDrawerChange(false)} />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
