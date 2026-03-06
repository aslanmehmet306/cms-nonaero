import { useAuthStore } from '@/store/authStore';

/**
 * Returns true if the current user is an auditor (read-only role).
 * Auditors can view all pages but cannot trigger mutations.
 */
export function useIsReadOnly(): boolean {
  const user = useAuthStore((s) => s.user);
  return user?.role === 'auditor';
}

/**
 * Returns true if the current user created the given entity.
 * Used for separation of duties — e.g., contract creator cannot approve.
 */
export function useIsCreator(createdById?: string): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user || !createdById) return false;
  return user.sub === createdById;
}
