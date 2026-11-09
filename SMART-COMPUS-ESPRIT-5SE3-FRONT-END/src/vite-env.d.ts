/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** URL du user-service (Node/Express, ex. http://localhost:4001). */
  readonly VITE_USER_API_BASE_URL?: string;
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_REAL_API_PREFIXES?: string;
  readonly VITE_EMAIL_DOMAIN?: string;
  readonly VITE_AGENT_URL?: string;
}
