import { Select } from "@/shared/components/ui/select";
import { useT } from "@/shared/i18n";
import type { Chambre } from "../types";

interface ChambrePickerProps {
  chambres: Chambre[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
}

/** Liste déroulante des chambres disponibles, groupées par bâtiment. */
export function ChambrePicker({ chambres, value, onChange, id = "housing-room", placeholder, invalid }: ChambrePickerProps) {
  const t = useT();
  const batiments = [...new Set(chambres.map((c) => c.batiment))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className={invalid ? "border-red-600" : undefined}
    >
      <option value="">{placeholder ?? t("housing.requests.roomPlaceholder")}</option>
      {batiments.map((batiment) => (
        <optgroup key={batiment} label={batiment}>
          {chambres
            .filter((c) => c.batiment === batiment)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {t("housing.rooms.roomLabel", { numero: c.numero })} — {t(`housing.type.${c.type}`)} (
                {t("housing.rooms.capacity", { count: c.capacite })})
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );
}
