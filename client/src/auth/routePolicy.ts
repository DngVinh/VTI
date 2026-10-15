import type { Role } from './types';
export const roleLanding = (_role: Role) => '/';
export const canAccess = (role: Role | undefined, allowed: Role[]) => !!role && allowed.includes(role);
