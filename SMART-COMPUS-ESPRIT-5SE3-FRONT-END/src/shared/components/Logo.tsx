import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useT } from "@/shared/i18n";

export function Logo() {
  const t = useT();
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label={`${t("app.name")} — ${t("nav.home")}`}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-navy text-white">
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      <span className="font-display text-lg font-semibold text-navy sm:text-xl">{t("app.name")}</span>
    </Link>
  );
}
