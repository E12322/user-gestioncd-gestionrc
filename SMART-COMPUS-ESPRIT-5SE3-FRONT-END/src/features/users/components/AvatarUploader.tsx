import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { UserAvatar } from "@/shared/components/common/UserAvatar";
import { isApiError } from "@/shared/api/errors";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { ImageError, imageToAvatarDataUrl } from "@/shared/lib/image";
import { updateAvatar } from "../api";
import { fullName, type UserAccount } from "../types";

/** Photo de profil : ajout, remplacement et suppression. L'image est recadrée en carré et réduite avant l'envoi. */
export function AvatarUploader({ account, onChanged }: { account: UserAccount; onChanged: () => void }) {
  const t = useT();
  const { updateUser, user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const src = account.avatarUrl;

  async function save(url: string | null) {
    setBusy(true);
    setError(undefined);
    try {
      await updateAvatar(account.id, url);
      if (user.id === account.id) updateUser({ avatarUrl: url ?? undefined });
      toast.success(t(url ? "users.avatar.saved" : "users.avatar.removed"));
      onChanged();
    } catch (e) {
      setError(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    try {
      await save(await imageToAvatarDataUrl(file));
    } catch (e) {
      if (e instanceof ImageError) setError(t(`users.avatar.err${e.code[0]!.toUpperCase()}${e.code.slice(1)}`));
      else setError(t("error.generic"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <UserAvatar name={fullName(account)} src={src} className="size-24 ring-4 ring-card" fallbackClassName="text-3xl" />
      <input
        ref={inputRef}
        id="avatar-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("users.avatar.title")}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Camera aria-hidden="true" />
          {src ? t("users.avatar.change") : t("users.avatar.add")}
        </Button>
        {src && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            className="text-red-700 hover:bg-red-50"
            onClick={() => void save(null)}
          >
            <Trash2 aria-hidden="true" />
            {t("users.avatar.remove")}
          </Button>
        )}
      </div>
      <p className="max-w-[16rem] text-center text-xs text-muted-foreground">{t("users.avatar.hint")}</p>
      {error && (
        <p role="alert" className="max-w-[16rem] text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
