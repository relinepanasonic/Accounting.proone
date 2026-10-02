// Which ledger account holds the money customers owe (Accounts Receivable). One rule for every screen
// that posts or clears a receivable, so invoices and payments always hit the SAME account.
// Pure module: safe for server actions and pages.

/** Accounts Receivable in every chart of accounts. (1200 is Fixed Assets; 1002 is a cash account.) */
export const DEFAULT_AR_ACCOUNT = '1100';

const NEVER_AR = new Set(['1200', '1002']);

/** The workspace's mapped AR account, or 1100. A mapping to a non-receivable account is ignored. */
export function resolveArAccount(mappings: { mapping_type: string; account_code: string }[]): string {
  const mapped = mappings.find((m) => m.mapping_type === 'AR')?.account_code;
  return mapped && !NEVER_AR.has(mapped) ? mapped : DEFAULT_AR_ACCOUNT;
}
