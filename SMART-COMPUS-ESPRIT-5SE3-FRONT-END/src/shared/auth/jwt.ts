import type { User } from "./roles";

/** Génère un faux JWT (non signé) pour que l'intercepteur API ait un jeton à envoyer en mode démo. */
export function fakeJwt(user: User) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: user.id, name: user.name, role: user.role })}.demo`;
}
