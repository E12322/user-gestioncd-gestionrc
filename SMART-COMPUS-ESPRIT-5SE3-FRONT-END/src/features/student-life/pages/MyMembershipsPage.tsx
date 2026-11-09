import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { useT } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { useMyMemberships } from "../hooks";

/** Étudiant : liste de ses propres adhésions aux clubs. */
export default function MyMembershipsPage() {
  const t = useT();
  const query = useMyMemberships();

  return (
    <div className="space-y-4">
      <QueryBoundary query={query} moduleName={t("module.student-life")}>
        {(memberships) =>
          memberships.length === 0 ? (
            <Card>
              <EmptyState icon={ClipboardList} title={t("life.myMemberships.empty")} />
            </Card>
          ) : (
            <div className="space-y-3">
              {memberships.map((m) => (
                <Card key={m.id} className="flex items-center justify-between p-4">
                  <div>
                    <Link
                      to={`/vie-etudiante/clubs/${m.clubId}`}
                      className="font-medium hover:underline"
                    >
                      {m.clubName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Demandée le {formatDateTime(m.requestedAt)}
                    </p>
                  </div>
                  <StatusPill status={m.status} />
                </Card>
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
