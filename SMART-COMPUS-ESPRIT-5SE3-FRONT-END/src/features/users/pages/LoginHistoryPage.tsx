import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Select } from "@/shared/components/ui/select";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { ServiceUnavailableView } from "@/shared/components/common/ErrorViews";
import { useT } from "@/shared/i18n";
import { LoginHistoryTable } from "../components/LoginHistoryTable";
import { useLoginHistory, useUsers } from "../hooks";
import { fullName, type LoginHistoryFilters } from "../types";

/** Historique de connexion de tous les comptes (administrateur). */
export default function LoginHistoryPage() {
  const t = useT();
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<LoginHistoryFilters["result"]>("");
  const history = useLoginHistory({ userId: userId || undefined, result });
  const users = useUsers({});

  if (history.error?.isUnavailable) return <ServiceUnavailableView moduleName={t("module.users")} onRetry={history.refetch} />;
  if (history.error && !history.data) {
    return (
      <Card>
        <EmptyState
          title={t("error.generic")}
          description={history.error.message}
          action={<Button onClick={history.refetch}>{t("common.retry")}</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-72">
          <label htmlFor="history-user" className="sr-only">
            {t("users.history.filterUser")}
          </label>
          <Select id="history-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">{t("users.history.allUsers")}</option>
            {users.data?.items.map((u) => (
              <option key={u.id} value={u.id}>
                {fullName(u)} ({u.id})
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor="history-result" className="sr-only">
            {t("users.history.result")}
          </label>
          <Select id="history-result" value={result} onChange={(e) => setResult(e.target.value as LoginHistoryFilters["result"])}>
            <option value="">{t("users.history.allResults")}</option>
            <option value="success">{t("users.history.success")}</option>
            <option value="failure">{t("users.history.failure")}</option>
          </Select>
        </div>
      </div>
      <LoginHistoryTable events={history.data} loading={history.isLoading && !history.data} showUser pageSize={10} />
    </div>
  );
}
