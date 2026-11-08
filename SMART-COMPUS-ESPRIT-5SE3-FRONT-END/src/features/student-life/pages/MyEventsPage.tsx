import { CalendarX } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { useMyRegistrations } from "../hooks";

/** Étudiant : événements auxquels il est inscrit. */
export default function MyEventsPage() {
  const t = useT();
  const query = useMyRegistrations();

  return (
    <div className="space-y-4">
      <QueryBoundary query={query} moduleName={t("module.student-life")}>
        {(registrations) =>
          registrations.length === 0 ? (
            <Card>
              <EmptyState icon={CalendarX} title={t("life.myEvents.empty")} />
            </Card>
          ) : (
            <div className="space-y-3">
              {registrations.map((r) => (
                <Card key={r.id} className="p-4">
                  <h3 className="font-medium">{r.eventTitle}</h3>
                  <p className="text-xs text-muted-foreground">
                    Inscrit le {formatDateTime(r.registeredAt)}
                  </p>
                </Card>
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
