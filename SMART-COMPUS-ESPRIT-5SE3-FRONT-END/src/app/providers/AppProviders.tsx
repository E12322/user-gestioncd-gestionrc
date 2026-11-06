import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/users";
import { I18nProvider } from "@/shared/i18n";
import { ModulesProvider } from "@/shared/modules/ModulesContext";
import { MODULES } from "@/app/modules";

/**
 * Assemble tous les fournisseurs globaux, du plus général au plus spécifique :
 * langue → session → registre des modules → routeur → notifications.
 * C'est la seule couche autorisée à connaître l'implémentation de la session (module Utilisateurs).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <ModulesProvider modules={MODULES}>
          <BrowserRouter>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </BrowserRouter>
        </ModulesProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
