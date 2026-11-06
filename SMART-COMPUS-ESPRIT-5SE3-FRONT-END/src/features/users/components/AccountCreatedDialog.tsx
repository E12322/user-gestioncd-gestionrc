import { Copy, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/components/ui/dialog";
import { useT } from "@/shared/i18n";
import { fullName, type AdminCreateResult } from "../types";

/** Confirmation après la création d'un compte : e-mail envoyé et, en démo seulement, le mot de passe temporaire. */
export function AccountCreatedDialog({ result, onClose }: { result: AdminCreateResult | null; onClose: () => void }) {
  const t = useT();

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("users.created.copied"));
    } catch {
      /* presse-papiers indisponible : le mot de passe reste lisible à l'écran */
    }
  }

  return (
    <Dialog open={result !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {result && (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800">
                <MailCheck className="size-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <DialogTitle>{t("users.created.title")}</DialogTitle>
                <DialogDescription>
                  {t("users.created.sent", { email: result.account.email, name: fullName(result.account) })}
                </DialogDescription>
              </div>
            </div>
            {result.demoTemporaryPassword && (
              <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-3 text-amber-950">
                <p className="text-sm font-semibold">{t("users.created.demoTitle")}</p>
                <p className="mt-1 text-sm">{t("users.created.demoBody")}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded bg-white px-3 py-1.5 font-mono text-base font-semibold tracking-wider">
                    {result.demoTemporaryPassword}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    onClick={() => void copy(result.demoTemporaryPassword!)}
                  >
                    <Copy aria-hidden="true" />
                    {t("users.created.copy")}
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={onClose}>{t("users.created.close")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
