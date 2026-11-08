import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { isApiError } from "@/shared/api/errors";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { chambreSchema, fieldErrors } from "../schemas";
import { CHAMBRE_TYPES, type ChambreInput, type ChambreType } from "../types";

type Errors = Partial<Record<"numero" | "batiment" | "etage" | "type" | "capacite", string>>;

interface ChambreFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ChambreInput) => Promise<void>;
  busy?: boolean;
}

/** Formulaire administrateur de création d'une chambre. */
export function ChambreFormDialog({ open, onOpenChange, onSubmit, busy }: ChambreFormDialogProps) {
  const t = useT();
  const [values, setValues] = useState({ numero: "", batiment: "", etage: 0, type: "DOUBLE" as ChambreType, capacite: 2 });
  const [errors, setErrors] = useState<Errors>({});
  const [serviceError, setServiceError] = useState<string>();

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServiceError(undefined);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const raw = fieldErrors(chambreSchema, values);
    if (Object.keys(raw).length) {
      setErrors(Object.fromEntries(Object.entries(raw).map(([k, m]) => [k, t(m)])));
      return;
    }
    try {
      await onSubmit(values);
      setValues({ numero: "", batiment: "", etage: 0, type: "DOUBLE", capacite: 2 });
      setErrors({});
    } catch (err) {
      setServiceError(isApiError(err) ? err.message : t("error.generic"));
    }
  }

  const errorText = (key: keyof Errors) =>
    errors[key] ? (
      <p className="flex items-start gap-1.5 text-sm text-red-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {errors[key]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{t("housing.rooms.form.title")}</DialogTitle>
        <DialogDescription>{t("housing.module.description")}</DialogDescription>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          {serviceError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {serviceError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="ch-numero" className="text-sm font-medium">
                {t("housing.rooms.form.numero")}
              </label>
              <Input
                id="ch-numero"
                value={values.numero}
                maxLength={20}
                placeholder={t("housing.rooms.form.numeroHint")}
                aria-invalid={errors.numero ? true : undefined}
                className={cn(errors.numero && "border-red-600")}
                onChange={(e) => set("numero", e.target.value)}
              />
              {errorText("numero")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ch-batiment" className="text-sm font-medium">
                {t("housing.rooms.form.batiment")}
              </label>
              <Input
                id="ch-batiment"
                value={values.batiment}
                maxLength={60}
                aria-invalid={errors.batiment ? true : undefined}
                className={cn(errors.batiment && "border-red-600")}
                onChange={(e) => set("batiment", e.target.value)}
              />
              {errorText("batiment")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ch-type" className="text-sm font-medium">
                {t("housing.rooms.form.type")}
              </label>
              <Select id="ch-type" value={values.type} onChange={(e) => set("type", e.target.value as ChambreType)}>
                {CHAMBRE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`housing.type.${type}`)}
                  </option>
                ))}
              </Select>
              {errorText("type")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ch-capacite" className="text-sm font-medium">
                {t("housing.rooms.form.capacite")}
              </label>
              <Input
                id="ch-capacite"
                type="number"
                min={1}
                max={4}
                value={values.capacite}
                aria-invalid={errors.capacite ? true : undefined}
                className={cn(errors.capacite && "border-red-600")}
                onChange={(e) => set("capacite", Number(e.target.value))}
              />
              {errorText("capacite")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ch-etage" className="text-sm font-medium">
                {t("housing.rooms.form.etage")}
              </label>
              <Input
                id="ch-etage"
                type="number"
                min={0}
                max={20}
                value={values.etage}
                aria-invalid={errors.etage ? true : undefined}
                className={cn(errors.etage && "border-red-600")}
                onChange={(e) => set("etage", Number(e.target.value))}
              />
              {errorText("etage")}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {t("housing.rooms.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
