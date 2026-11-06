import { Link } from "react-router-dom";
import { CloudOff, Compass, ShieldAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { useT } from "@/shared/i18n";
import { useAuth } from "@/shared/auth/AuthContext";
import { ROLE_LABEL } from "@/shared/auth/roles";
import type { ReactNode } from "react";

function ErrorCard({
  icon: Icon,
  code,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  code?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card role="alert" className="mx-auto my-8 flex max-w-xl flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-red-100 text-red-800">
        <Icon className="size-8" aria-hidden="true" />
      </div>
      {code && <p className="text-sm font-semibold tracking-widest text-muted-foreground">{code}</p>}
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-md text-muted-foreground">{description}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>
    </Card>
  );
}

/** 403 — rôle insuffisant. */
export function ForbiddenView() {
  const t = useT();
  const { role } = useAuth();
  return (
    <ErrorCard
      icon={ShieldAlert}
      code="403"
      title={t("error.403.title")}
      description={t("error.403.description", { role: t(ROLE_LABEL[role]) })}
    >
      <Button asChild>
        <Link to="/">{t("soon.backHome")}</Link>
      </Button>
    </ErrorCard>
  );
}

export function NotFoundView() {
  const t = useT();
  return (
    <ErrorCard icon={Compass} code="404" title={t("error.404.title")} description={t("error.404.description")}>
      <Button asChild>
        <Link to="/">{t("soon.backHome")}</Link>
      </Button>
    </ErrorCard>
  );
}

/** Service d'un module indisponible : n'affecte que la zone de contenu de ce module. */
export function ServiceUnavailableView({ moduleName, onRetry }: { moduleName: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <ErrorCard
      icon={CloudOff}
      code="503"
      title={t("error.unavailable.title")}
      description={t("error.unavailable.description", { module: moduleName })}
    >
      {/* En développement, rappelle que le mode démo permet de simuler une panne : évite de chercher un bug côté backend. */}
      {import.meta.env.DEV && (
        <p className="max-w-md rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {t("error.unavailable.hint")}
        </p>
      )}
      {onRetry && <Button onClick={onRetry}>{t("common.retry")}</Button>}
      <Button variant="outline" asChild>
        <Link to="/">{t("soon.backHome")}</Link>
      </Button>
    </ErrorCard>
  );
}
