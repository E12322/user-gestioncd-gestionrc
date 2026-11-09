import { Bell, ChevronDown, LogOut, Mail, Search, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserAvatar } from "@/shared/components/common/UserAvatar";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Logo } from "@/shared/components/Logo";
import { useAuth } from "@/shared/auth/AuthContext";
import { ROLE_LABEL } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";

const UNREAD_NOTIFICATIONS = 3;

export function TopBar() {
  const t = useT();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 lg:px-6">
        <Logo />

        {/* Recherche globale : centrée ≥ md, pleine largeur sous le logo sur mobile */}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            toast.info(t("soon.title"));
          }}
          className="order-last w-full md:order-none md:mx-auto md:w-auto md:flex-1 md:max-w-xl"
        >
          <label htmlFor="global-search" className="sr-only">
            {t("topbar.search.label")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="global-search"
              type="search"
              placeholder={t("topbar.search.placeholder")}
              className="h-10 w-full rounded-full border border-input bg-secondary/60 pl-9 pr-4 text-sm placeholder:text-muted-foreground"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={t("topbar.notifications.count", { count: UNREAD_NOTIFICATIONS })}
          >
            <Bell className="size-5" aria-hidden="true" />
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex size-[18px] items-center justify-center rounded-full bg-amber-brand text-[11px] font-bold text-slate-900"
            >
              {UNREAD_NOTIFICATIONS}
            </span>
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("topbar.messages")}>
            <Mail className="size-5" aria-hidden="true" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("topbar.userMenu")}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-secondary"
              >
                <UserAvatar name={user.name} src={user.avatarUrl} />
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block text-sm font-semibold">{user.name}</span>
                  <span className="block text-xs text-muted-foreground">{t(ROLE_LABEL[user.role])}</span>
                </span>
                <ChevronDown className="hidden size-4 text-muted-foreground lg:block" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-muted-foreground">{t("topbar.id", { id: user.id })}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate("/profil")}>
                <Settings aria-hidden="true" />
                {t("topbar.profileSettings")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  logout();
                  navigate("/connexion");
                }}
                className="text-red-700 data-[highlighted]:bg-red-50"
              >
                <LogOut aria-hidden="true" />
                {t("topbar.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
