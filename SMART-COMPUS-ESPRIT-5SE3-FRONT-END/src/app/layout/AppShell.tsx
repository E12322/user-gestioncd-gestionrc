import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { AssistantWidget } from "./AssistantWidget";
import { useT } from "@/shared/i18n";

const COLLAPSE_KEY = "smartcampus.sidebarCollapsed";

export function AppShell() {
  const t = useT();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignoré */
      }
      return !c;
    });

  // Accessibilité : après un changement de page, le focus revient au contenu principal.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-white"
      >
        {t("app.skipToContent")}
      </a>
      <TopBar />
      <div className="flex">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <main id="contenu" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 px-4 pb-24 pt-6 outline-none lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav drawerOpen={drawerOpen} onDrawerChange={setDrawerOpen} />
      <AssistantWidget />
    </div>
  );
}
