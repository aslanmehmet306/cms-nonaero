import { SetMetadata } from '@nestjs/common';

/** Metadata key for @Audit() decorator. */
export const AUDIT_KEY = 'audit_entity_type';

/**
 * Marks a controller method for automatic audit logging.
 * The interceptor reads this metadata to determine the entity type.
 *
 * @param entityType - The entity type string stored in audit_log.entity_type (e.g. 'User', 'Contract')
 */
export const Audit = (entityType: string) => SetMetadata(AUDIT_KEY, entityType);
