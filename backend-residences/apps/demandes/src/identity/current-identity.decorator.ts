import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Identity } from './identity';

/** Extrait l'identite (X-User-Id / X-Role) posee par la passerelle. */
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Identity | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const userId: string | undefined = request.headers?.['x-user-id'];
    const role: string | undefined = request.headers?.['x-role'];
    if (!userId || !role) return undefined;
    return { userId, role };
  },
);
