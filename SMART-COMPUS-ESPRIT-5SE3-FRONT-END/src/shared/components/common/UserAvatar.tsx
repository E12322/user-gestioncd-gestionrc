import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { initials } from "@/shared/lib/utils";

interface UserAvatarProps {
  name: string;
  /** Photo de profil ; sans photo (ou si elle ne charge pas), les initiales s'affichent. */
  src?: string;
  className?: string;
  fallbackClassName?: string;
}

/** Avatar d'un utilisateur : photo de profil ou initiales. Décoratif : le nom est toujours écrit à côté. */
export function UserAvatar({ name, src, className, fallbackClassName }: UserAvatarProps) {
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className={fallbackClassName}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
