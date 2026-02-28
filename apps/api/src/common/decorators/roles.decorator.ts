import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@shared-types/enums';

/** Metadata key for @Roles() decorator. */
export const ROLES_KEY = 'roles';

/** Metadata key for @ExcludeCreator() decorator. */
export const EXCLUDE_CREATOR_KEY = 'excludeCreator';

/**
 * Restricts access to users with one of the specified roles.
 * Evaluated by RolesGuard after JWT authentication.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Enforces separation of duties: rejects requests where the
 * authenticated user matches the resource creator.
 */
export const ExcludeCreator = () => SetMetadata(EXCLUDE_CREATOR_KEY, true);
