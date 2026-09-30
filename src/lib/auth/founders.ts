// Keep identical to public.ads_founder_emails() and public.is_founder() in SQL.
// Pure module (no next/headers) so the proxy can import it.
const FOUNDER_EMAILS = ['nicojapar@gmail.com'];

export const isFounderEmail = (email?: string | null) =>
  !!email && FOUNDER_EMAILS.includes(email.trim().toLowerCase());
