import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as publicly accessible, bypassing the auth guard.
 * The real JWT validation against the external IAuthentification
 * (Utilisateurs service) contract will be wired in a later phase.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
