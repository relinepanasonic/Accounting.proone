import { createAdminClient } from '@/lib/api/supabase-admin';
import type { MediaStorage } from './send-media';

/** Supabase Storage (private bucket "wa-files") as the place sent files are kept and linked from. */
export function adminMediaStorage(): MediaStorage {
  const db = createAdminClient();
  return {
    upload: async (path, data, contentType) => !(await db.storage.from('wa-files').upload(path, data, { contentType, upsert: true })).error,
    signedUrl: async (path, seconds) => (await db.storage.from('wa-files').createSignedUrl(path, seconds)).data?.signedUrl ?? null,
  };
}
