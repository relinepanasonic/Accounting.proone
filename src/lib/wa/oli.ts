/**
 * Oli is the admin persona of Professor Online (the company WhatsApp number). Reports to the BOD are written
 * as coming from Oli: a short greeting on top and a sign-off at the bottom. Pure text, so it is easy to test.
 */

export const OLI_NAME = 'Oli';

const INTRO: Record<string, string> = {
  daily: 'laporan harian tim untuk kemarin',
  weekly: 'laporan mingguan tim',
  monthly: 'laporan bulanan tim',
};

export function signAsOli(kind: string, message: string): string {
  const body = message.trim();
  if (!body) return '';
  const what = INTRO[kind] || 'laporan tim';
  return `Halo BOD, saya ${OLI_NAME}, admin Professor Online. Berikut ${what}:\n\n${body}\n\nSalam,\n${OLI_NAME} | Admin Professor Online`;
}
