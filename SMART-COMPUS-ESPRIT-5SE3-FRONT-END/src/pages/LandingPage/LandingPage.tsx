import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ROLE_LABEL, ROLES } from "@/shared/auth/roles";
import { useModules } from "@/shared/modules/ModulesContext";
import { Logo } from "@/shared/components/Logo";
import { useT } from "@/shared/i18n";
import "./i18n";

gsap.registerPlugin(useGSAP);

const WHY = [1, 2, 3] as const;

/** Extrait de semaine type : mêmes types de séance que l'emploi du temps réel (CM, TD, TP). */
const PREVIEW = [
  { n: 1, time: "08:30", kind: "CM", tint: "bg-blue-50 text-navy" },
  { n: 2, time: "10:15", kind: "TD", tint: "bg-amber-50 text-amber-900" },
  { n: 3, time: "14:00", kind: "TP", tint: "bg-green-50 text-green-900" },
  { n: 4, time: "09:00", kind: "CM", tint: "bg-blue-50 text-navy" },
] as const;

/** Met à jour le titre et la description de la page (utile au référencement et à l'onglet du navigateur). */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const previousContent = meta.content;
    meta.content = description;
    return () => {
      document.title = previous;
      if (created) meta.remove();
      else meta.content = previousContent;
    };
  }, [title, description]);
}

/** Menu des ancres sur petits écrans : bouton « Menu » + liste à plat ; se ferme avec Échap ou après un choix. */
function MobileMenu({ items, registerLabel, label }: { items: { href: string; text: string }[]; registerLabel: string; label: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="sm"
        className="px-2"
        aria-expanded={open}
        aria-controls="menu-mobile"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown className={open ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden="true" />
      </Button>
      {open && (
        <nav id="menu-mobile" aria-label={label} className="absolute inset-x-0 top-full border-b bg-background px-4 pb-4 pt-2 shadow-card">
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.href}>
                <a href={i.href} onClick={() => setOpen(false)} className="block py-3 text-base font-medium">
                  {i.text}
                </a>
              </li>
            ))}
            <li>
              <Link to="/inscription" className="block py-3 text-base font-medium text-primary">
                {registerLabel}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

/** Page d'accueil publique : affichée sur « / » tant qu'aucune session n'est ouverte. */
export default function LandingPage() {
  const t = useT();
  const { modules: MODULES } = useModules();
  usePageMeta(t("home.meta.title"), t("home.meta.description"));

  // Le seul moment animé de la page : le héros se pose, puis les séances de la semaine type arrivent une à une.
  // Sans animation si l'utilisateur demande moins de mouvement : tout reste visible et statique.
  const hero = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "expo.out", clearProps: "all" } })
          .from("[data-hero='title']", { y: 18, opacity: 0, duration: 0.8 })
          .from("[data-hero='body']", { y: 12, opacity: 0, duration: 0.7, stagger: 0.08 }, "-=0.55")
          .from("[data-hero='row']", { y: 10, opacity: 0, duration: 0.6, stagger: 0.09 }, "-=0.5");
      });
    },
    { scope: hero },
  );

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg"
      >
        {t("app.skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <Logo />
          <nav aria-label={t("home.nav.label")} className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a
              href="#services"
              className="rounded text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline"
            >
              {t("home.nav.modules")}
            </a>
            <a
              href="#profils"
              className="rounded text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline"
            >
              {t("home.nav.roles")}
            </a>
            <a
              href="#pourquoi"
              className="rounded text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline"
            >
              {t("home.nav.why")}
            </a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <MobileMenu
              label={t("home.menu")}
              registerLabel={t("home.register")}
              items={[
                { href: "#services", text: t("home.nav.modules") },
                { href: "#profils", text: t("home.nav.roles") },
                { href: "#pourquoi", text: t("home.nav.why") },
              ]}
            />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/inscription">{t("home.register")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/connexion">{t("home.login")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="contenu">
        {/* ---------- Héro ---------- */}
        <section ref={hero} className="border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h1 data-hero="title" className="text-5xl leading-[1.05] text-navy sm:text-6xl">
                {t("home.hero.lead")}{" "}
                <span className="underline decoration-amber-brand decoration-[0.09em] underline-offset-[0.14em]">
                  {t("home.hero.word4")}
                </span>
              </h1>
              <p data-hero="body" className="mt-6 max-w-[58ch] text-lg text-muted-foreground">
                {t("home.hero.text")}
              </p>
              <div data-hero="body" className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild className="group">
                  <Link to="/connexion">
                    {t("home.hero.cta")}
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#services">{t("home.hero.secondary")}</a>
                </Button>
              </div>
              <p data-hero="body" className="mt-5 max-w-[58ch] text-sm text-muted-foreground">
                {t("home.hero.access")}{" "}
                <Link to="/inscription" className="font-medium text-primary underline underline-offset-4 hover:no-underline">
                  {t("home.register")}
                </Link>
              </p>
            </div>

            {/* Aperçu : extrait typographique de l'emploi du temps, à plat, sans effet. */}
            <figure role="img" aria-label={t("home.preview.label")}>
              <figcaption className="flex items-baseline justify-between border-b-2 border-navy pb-2">
                <span className="font-display text-xl font-semibold text-navy">{t("home.preview.heading")}</span>
                <span className="text-sm text-muted-foreground">{t("home.preview.note")}</span>
              </figcaption>
              <ol className="divide-y">
                {PREVIEW.map(({ n, time, kind, tint }) => (
                  <li key={n} data-hero="row" className="grid grid-cols-[4.5rem_3rem_minmax(0,1fr)] items-baseline gap-x-4 py-4">
                    <span className="text-sm font-medium text-muted-foreground">{t(`home.preview.${n}.day`)}</span>
                    <span className="tabular text-sm font-semibold">{time}</span>
                    <span className="min-w-0">
                      <span className="block font-medium">{t(`home.preview.${n}.title`)}</span>
                      <span className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tint}`}>{kind}</span>
                        {t(`home.preview.${n}.place`)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </figure>
          </div>
        </section>

        {/* ---------- Services ---------- */}
        <section
          id="services"
          aria-labelledby="services-title"
          className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16"
        >
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 id="services-title" className="text-3xl sm:text-4xl">
              {t("home.modules.title")}
            </h2>
            <p className="mt-4 max-w-[48ch] text-muted-foreground">{t("home.modules.subtitle")}</p>
          </div>
          <ul className="border-t">
            {MODULES.map((m) => (
              <li key={m.id} className="grid gap-x-6 gap-y-1 border-b py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                <h3 className="flex items-center gap-3 font-semibold">
                  <m.icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  {t(m.labelKey)}
                </h3>
                <div>
                  <p className="text-sm text-foreground/80">{t(`home.module.${m.id}`)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("home.module.for", { roles: m.roles.map((r) => t(ROLE_LABEL[r])).join(", ") })}
                  </p>
                </div>
                <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 rounded-md bg-secondary px-3 py-2 text-sm sm:col-span-2">
                  <span className="font-medium">{t(`home.proof.${m.id}.what`)}</span>
                  <span className="tabular text-muted-foreground">{t(`home.proof.${m.id}.state`)}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Profils ---------- */}
        <section id="profils" aria-labelledby="profils-title" className="scroll-mt-20 border-y bg-secondary">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="profils-title" className="text-3xl sm:text-4xl">
              {t("home.roles.title")}
            </h2>
            <p className="mt-4 max-w-[58ch] text-muted-foreground">{t("home.roles.subtitle")}</p>
            <ul className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x">
              {ROLES.map((r) => (
                <li key={r} className="md:px-8 md:first:pl-0 md:last:pr-0">
                  <h3 className="font-display text-xl font-semibold">{t(ROLE_LABEL[r])}</h3>
                  <p className="mt-2 text-muted-foreground">{t(`home.roles.${r}`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Pourquoi ---------- */}
        <section id="pourquoi" aria-labelledby="pourquoi-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 id="pourquoi-title" className="text-3xl sm:text-4xl">
            {t("home.why.title")}
          </h2>
          <dl className="mt-10 grid gap-8 md:grid-cols-3">
            {WHY.map((n) => (
              <div key={n} className="border-t-2 border-navy pt-4">
                <dt className="text-lg font-semibold">{t(`home.why.${n}.title`)}</dt>
                <dd className="mt-2 text-pretty text-muted-foreground">{t(`home.why.${n}.text`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- Appel à l'action ---------- */}
        <section aria-labelledby="cta-title" className="bg-navy text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="cta-title" className="text-3xl sm:text-4xl">
                {t("home.cta.title")}
              </h2>
              <p className="mt-3 max-w-[52ch] text-blue-100">{t("home.cta.text")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild className="bg-amber-brand font-semibold text-slate-950 hover:bg-amber-brand/90">
                <Link to="/connexion">{t("home.login")}</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/inscription">{t("home.register")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6">{t("home.footer")}</p>
      </footer>
    </div>
  );
}
