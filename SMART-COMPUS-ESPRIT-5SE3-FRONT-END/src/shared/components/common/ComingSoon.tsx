import { Link } from "react-router-dom";
import { Hammer } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { EmptyState } from "./EmptyState";
import { useT } from "@/shared/i18n";
import type { ModuleDef } from "@/shared/types/module";

export function ComingSoon({ module }: { module: ModuleDef }) {
  const t = useT();
  return (
    <Card>
      <EmptyState
        icon={Hammer}
        title={t("soon.title")}
        description={t("soon.description", { module: t(module.labelKey) })}
        className="py-20"
        action={
          <Button variant="outline" asChild>
            <Link to="/">{t("soon.backHome")}</Link>
          </Button>
        }
      />
    </Card>
  );
}
