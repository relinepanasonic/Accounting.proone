import { createHash, randomBytes } from 'crypto';

export const INVITE_TTL_DAYS = 7;
export const INVITE_ROLES = ['superadmin', 'accounting', 'admin', 'advertiser', 'client'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** A random, unguessable link token (256 bits). Only its hash is stored. */
export const newInviteToken = () => randomBytes(32).toString('base64url');
export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex');
