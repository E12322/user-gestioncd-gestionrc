import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { api } from "@/shared/api/client";
import { ApiError, isApiError } from "@/shared/api/errors";

/** Démonstration d'une erreur 409 renvoyée par l'API (double réservation). */
export default function ConflictDemo() {
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(false);

  async function reserve() {
    setLoading(true);
    setError(undefined);
    try {
      await api.post("/resources/reservations", {
        body: { room: "Amphi A", slot: "10:00-12:00" },
        mock: () => {
          throw new ApiError(409, "Conflit de réservation", { conflicts: ["Amphi A — 10:00–12:00 (K. Trabelsi)"] });
        },
      });
    } catch (e) {
      if (isApiError(e)) setError(e);
    } finally {
      setLoading(false);
    }
  }

  const conflicts = (error?.details as { conflicts?: string[] } | undefined)?.conflicts;

  return (
    <div className="space-y-6">
      <PageHeader title="Démo : erreur 409" description="Le serveur refuse l'action car elle entre en conflit avec une donnée existante." />
      <Card>
        <CardContent className="space-y-4 pt-5">
          <Button onClick={() => void reserve()} disabled={loading}>
            Réserver l'Amphi A (10:00–12:00)
          </Button>
          {error?.isConflict && <ConflictAlert conflicts={conflicts} />}
        </CardContent>
      </Card>
    </div>
  );
}
