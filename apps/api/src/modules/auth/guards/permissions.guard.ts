import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { AccessService } from '../access.service';

/** Enforces @Permissions() scopes against the authenticated user's effective permissions. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user: AuthenticatedUser | undefined = context
      .switchToHttp()
      .getRequest().user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (!AccessService.has(user.permissions, required)) {
      throw new ForbiddenException(
        `Missing required permission(s): ${required.join(', ')}`,
      );
    }
    return true;
  }
}
