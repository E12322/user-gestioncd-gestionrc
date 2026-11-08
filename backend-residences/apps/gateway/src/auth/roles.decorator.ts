import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'residences:roles';

/** Restreint la route aux rles listes (eg. @Roles('admin')). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
