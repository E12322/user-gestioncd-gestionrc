import { useSearchParams } from "react-router-dom";
import { ReservationForm } from "../components/ReservationForm";

/** Formulaire de réservation ; `?salle=<id>` pré-sélectionne la salle (lien depuis la fiche de salle). */
export default function ReservationRequestPage() {
  const [params] = useSearchParams();
  const roomId = params.get("salle") ?? undefined;
  return <ReservationForm key={roomId} initialRoomId={roomId} />;
}
