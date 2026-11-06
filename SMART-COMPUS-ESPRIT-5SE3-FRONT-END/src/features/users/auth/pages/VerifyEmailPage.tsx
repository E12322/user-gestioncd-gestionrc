import { USE_MOCKS } from "@/shared/api/client";
import { useCallback, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { isApiError } from "@/shared/api/errors";
import { useT } from "@/shared/i18n";
import { DEMO_CODE } from "../../mocks";
import { resendActivation, verifyEmail } from "../api.mock";
import { AuthShell } from "../components/AuthShell";
import { CountdownButton } from "../components/CountdownButton";
import { OtpInput } from "../components/OtpInput";

/** Étape « vérifiez votre boîte mail » après la création du compte (lien d'activation ou code à 6 chiffres). */
export default function VerifyEmailPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      setError(undefined);
      setChecking(true);
      try {
        await verifyEmail(email, value);
        toast.success(t("users.verify.done"));
        navigate("/connexion", { replace: true });
      } catch (e) {
        setCode("");
        setError(
          isApiError(e) && e.status === 400
            ? t("users.verify.badCode")
            : isApiError(e) && e.isUnavailable
              ? t("error.unavailable.title")
              : t("error.generic"),
        );
        setChecking(false);
      }
    },
    [email, navigate, t],
  );

  if (!email) return <Navigate to="/inscription" replace />;

  return (
    <AuthShell title={t("users.verify.title")}>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-blue-50 text-navy">
          <Mail className="size-8" aria-hidden="true" />
        </div>
        <p role="status">{t("users.verify.sent", { email })}</p>

        <div className="space-y-3">
          <Button asChild size="lg" className="w-full">
            <a href={`mailto:${email}`}>{t("users.verify.openMail")}</a>
          </Button>
          <CountdownButton
            variant="outline"
            size="lg"
            className="w-full"
            startCounting
            label={t("users.verify.resend")}
            countdownLabel={(s) => t("users.verify.resendIn", { seconds: s })}
            onClick={async () => {
              try {
                await resendActivation(email);
                toast.success(t("users.verify.resent"));
              } catch (e) {
                toast.error(t("error.generic"));
                throw e;
              }
            }}
          />
          <Link
            to={`/inscription?email=${encodeURIComponent(email)}`}
            className="inline-block rounded text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("users.verify.changeEmail")}
          </Link>
        </div>

        <div className="border-t pt-6">
          <p id="otp-help" className="mb-3 text-sm text-muted-foreground">
            {t("users.verify.codeHelp")}
          </p>
          <OtpInput
            label={t("users.verify.codeLabel")}
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(undefined);
            }}
            onComplete={(v) => void submit(v)}
            disabled={checking}
            invalid={Boolean(error)}
            describedBy={error ? "otp-error" : "otp-help"}
          />
          <p id="otp-error" role="alert" className="mt-2 min-h-5 text-sm text-red-700">
            {error}
          </p>
          {USE_MOCKS && (
            <p className="mt-2 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
              {t("users.verify.demoHint", { code: DEMO_CODE })}
            </p>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
