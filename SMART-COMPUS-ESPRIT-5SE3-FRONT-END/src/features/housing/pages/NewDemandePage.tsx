import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { createDemande } from "../api";
import { ChambrePicker } from "../components/ChambrePicker";
import { useChambresDisponibles, useViewer } from "../hooks";
import { demandeSchema, fieldErrors } from "../schemas";
import { defaultDeparture, todayISO } from "../utils/time";

type Errors = Partial<Record<"dateArrivee" | "dateDepart" | "chambreId", string>>;

/** Étudiant : formulaire de dépôt d'une demande d'hébergement. */
export default function NewDemandePage() {
  const t = useT();
  const viewer = useViewer();
  const navigate = useNavigate();
  const disponibles = useChambresDisponibles();
  const { mutate, isPending } = useMutation(createDemande);

  const [values, setValues] = useState({ dateArrivee: todayISO(), dateDepart: defaultDeparture(), chambreId: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [serviceError, setServiceError] = useState<string>();

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServiceError(undefined);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const raw = fieldErrors(demandeSchema, values);
    if (Object.keys(raw).length) {
      setErrors(Object.fromEntries(Object.entries(raw).map(([k, m]) => [k, t(m)])));
      return;
    }
    try {
      await mutate(
        { etudiantId: viewer.id, dateArrivee: values.dateArrivee, dateDepart: values.dateDepart, chambreId: values.chambreId || undefined },
        viewer,
      );
      toast.success(t("housing.new.sent"));
      navigate("/residences/demandes");
    } catch (err) {
      setServiceError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  const errorText = (key: keyof Errors) =>
    errors[key] ? (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("housing.new.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("housing.new.description")}</p>
      </div>

      <Card className="p-5 sm:p-6">
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          {serviceError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {serviceError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="dem-arrivee" className="text-sm font-medium">
                {t("housing.field.arrivee")}
              </label>
              <Input
                id="dem-arrivee"
                type="date"
                min={todayISO()}
                value={values.dateArrivee}
                aria-invalid={errors.dateArrivee ? true : undefined}
                className={cn(errors.dateArrivee && "border-red-600")}
                onChange={(e) => set("dateArrivee", e.target.value)}
              />
              {errorText("dateArrivee")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dem-depart" className="text-sm font-medium">
                {t("housing.field.depart")}
              </label>
              <Input
                id="dem-depart"
                type="date"
                min={values.dateArrivee || todayISO()}
                value={values.dateDepart}
                aria-invalid={errors.dateDepart ? true : undefined}
                className={cn(errors.dateDepart && "border-red-600")}
                onChange={(e) => set("dateDepart", e.target.value)}
              />
              {errorText("dateDepart")}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dem-chambre" className="text-sm font-medium">
              {t("housing.field.chambreOptional")}
            </label>
            <QueryBoundary query={disponibles} moduleName={t("module.housing")} skeleton={<Skeleton className="h-10 w-full" />}>
              {(list) => (
                <ChambrePicker
                  id="dem-chambre"
                  chambres={list}
                  value={values.chambreId}
                  placeholder={t("housing.field.chambreNone")}
                  onChange={(id) => set("chambreId", id)}
                />
              )}
            </QueryBoundary>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? t("housing.new.submitting") : t("housing.new.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
