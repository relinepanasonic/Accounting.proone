export function formatCurrency(amount: number): string {
  // Use en-US to get comma as thousand separator (e.g. 1,000.00)
  // And minimumFractionDigits: 0 means we only show decimals if they exist
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `Rp ${formatted}`;
}
