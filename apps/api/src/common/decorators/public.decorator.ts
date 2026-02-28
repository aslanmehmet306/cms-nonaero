import { SetMetadata } from '@nestjs/common';

/** Metadata key for @Public() decorator. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as publicly accessible (no JWT required).
 * Used by JwtAuthGuard to skip authentication.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
