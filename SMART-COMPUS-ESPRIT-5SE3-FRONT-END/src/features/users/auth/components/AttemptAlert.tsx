import { Link } from "react-router-dom";
import { CircleAlert, Lock, ShieldAlert } from "lucide-react";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

type AttemptAlertProps =
  { kind: "error"; message: string } | { kind: "warning" | "locked"; attempts: number; max: number; message?: string };

/** Alerte de connexion : erreur simple, compteur d'échecs (« n/5 ») ou compte suspendu. */
export function AttemptAlert(props: AttemptAlertProps) {
  const t = useT();
  const locked = props.kind === "locked";
  const tone = props.kind === "error" ? "red" : locked ? "red" : "amber";
  const Icon = props.kind === "error" ? CircleAlert : locked ? Lock : ShieldAlert;

  return (
    <div
      role="alert"
      className={cn(
        "animate-enter-alert flex gap-3 rounded-xl border p-4",
        tone === "red" ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", tone === "red" ? "text-red-700" : "text-amber-700")} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        {props.kind === "error" ? (
          <p className="text-sm font-medium">{props.message}</p>
        ) : (
          <>
            <p className="font-semibold">{locked ? t("users.lock.title", { max: props.max }) : props.message}</p>
            <p className="text-sm">
              {locked ? t("users.lock.description") : t("users.lock.remaining", { remaining: props.max - props.attempts })}
            </p>
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label={t("users.lock.counter", { attempts: props.attempts, max: props.max })}
                aria-valuenow={props.attempts}
                aria-valuemin={0}
                aria-valuemax={props.max}
                className="h-2 w-32 overflow-hidden rounded-full bg-white ring-1 ring-black/15"
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-150", locked ? "bg-red-600" : "bg-amber-600")}
                  style={{ width: `${(props.attempts / props.max) * 100}%` }}
                />
              </div>
              <span className="text-sm font-semibold">{t("users.lock.counter", { attempts: props.attempts, max: props.max })}</span>
            </div>
            {locked && (
              <Link to="/mot-de-passe-oublie" className="inline-block text-sm font-medium underline">
                {t("users.lock.reset")}
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
