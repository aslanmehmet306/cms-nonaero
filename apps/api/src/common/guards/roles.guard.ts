import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@shared-types/enums';
import { ROLES_KEY, EXCLUDE_CREATOR_KEY } from '../decorators/roles.decorator';

/**
 * RBAC guard enforcing role-based access and separation of duties.
 *
 * - Checks @Roles() metadata: user.role must be in the required list
 * - Checks @ExcludeCreator() metadata: actor must differ from resource creator
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check required roles
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no roles required, allow access (auth-only check handled by JwtAuthGuard)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // User must exist (authenticated) and have one of the required roles
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have the required role to access this resource');
    }

    // Check separation of duties (@ExcludeCreator)
    const excludeCreator = this.reflector.getAllAndOverride<boolean>(EXCLUDE_CREATOR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (excludeCreator) {
      // Check createdBy in body or params
      const createdBy = request.body?.createdBy || request.params?.createdBy;

      if (createdBy && createdBy === user.sub) {
        throw new ForbiddenException(
          'Separation of duties: you cannot approve a resource you created',
        );
      }
    }

    return true;
  }
}
