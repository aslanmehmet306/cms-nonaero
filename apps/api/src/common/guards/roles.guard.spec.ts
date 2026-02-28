import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@shared-types/enums';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockExecutionContext = (
    user: Record<string, unknown> | undefined,
    body: Record<string, unknown> = {},
    params: Record<string, unknown> = {},
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, body, params }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no @Roles() decorator is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = mockExecutionContext({ sub: 'user-1', role: UserRole.tenant_user });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has the required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce([UserRole.super_admin, UserRole.airport_admin]);

    const context = mockExecutionContext({ sub: 'user-1', role: UserRole.super_admin });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject access when user lacks the required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce([UserRole.super_admin, UserRole.airport_admin]);

    const context = mockExecutionContext({ sub: 'user-1', role: UserRole.tenant_user });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should reject approval when actor matches creator (@ExcludeCreator)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce([UserRole.super_admin]) // ROLES_KEY
      .mockReturnValueOnce(true); // EXCLUDE_CREATOR_KEY

    const context = mockExecutionContext(
      { sub: 'user-1', role: UserRole.super_admin },
      { createdBy: 'user-1' },
    );

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException(
        'Separation of duties: you cannot approve a resource you created',
      ),
    );
  });

  it('should allow approval when actor differs from creator', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce([UserRole.super_admin]) // ROLES_KEY
      .mockReturnValueOnce(true); // EXCLUDE_CREATOR_KEY

    const context = mockExecutionContext(
      { sub: 'user-2', role: UserRole.super_admin },
      { createdBy: 'user-1' },
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});
