import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { ChangePasswordForm } from "../../components/ChangePasswordForm";
import { AuthShell } from "../components/AuthShell";

/** Première connexion avec un mot de passe temporaire : l'utilisateur doit en choisir un nouveau avant de continuer. */
export default function ChangePasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <AuthShell
      title={t("users.force.title")}
      description={t("users.force.description")}
      footer={
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            logout();
            navigate("/connexion", { replace: true });
          }}
        >
          {t("users.force.logout")}
        </Button>
      }
    >
      <ChangePasswordForm forced idPrefix="force" onDone={() => navigate("/", { replace: true })} />
    </AuthShell>
  );
}
