/**
 * Which app a chat lives in. WhatsApp chats are keyed by the phone number (digits); Instagram and Facebook Messenger chats by the person's id
 * on that app, with a prefix: "ig:<id>" and "fb:<id>". The same prefix is on the device row of the account they wrote to ("fb:<page id>").
 * Pure, so the rules are tested.
 */
export type ChatChannel = 'whatsapp' | 'instagram' | 'messenger';

export const chatChannel = (waId: string | null | undefined): ChatChannel => {
  const v = String(waId ?? '');
  return v.startsWith('ig:') ? 'instagram' : v.startsWith('fb:') ? 'messenger' : 'whatsapp';
};
export const isMetaChat = (waId: string | null | undefined) => chatChannel(waId) !== 'whatsapp';
export const metaChatId = (channel: 'instagram' | 'messenger', userId: string) => `${channel === 'instagram' ? 'ig' : 'fb'}:${userId}`;
export const metaUserId = (waId: string) => String(waId).replace(/^(ig|fb):/, '');

/** The last 9 digits of a phone number, to match a chat with an ERP client. Instagram and Messenger ids are not phone numbers: always ''. */
export const phoneTail = (s: unknown): string => {
  const v = String(s ?? '');
  return /^(ig|fb):/.test(v) ? '' : v.replace(/\D/g, '').slice(-9);
};

/** What to call a chat with no name yet: the number for WhatsApp, the app otherwise. */
export const chatLabel = (waId: string): string => {
  const c = chatChannel(waId);
  return c === 'instagram' ? 'Instagram user' : c === 'messenger' ? 'Messenger user' : `+${waId}`;
};

/** A phone number to put on a new ERP client made from this chat: none for Instagram and Messenger. */
export const clientPhoneOf = (waId: string): string | null => (isMetaChat(waId) ? null : `+${waId}`);

export const CHANNEL_NAME: Record<ChatChannel, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };

/**
 * Instagram and Messenger only let a business message a person within 24 hours of that person's last message (Meta's rule).
 * WhatsApp through Fonnte has no such window.
 */
export const REPLY_WINDOW_HOURS = 24;
export function replyWindowOpen(channel: ChatChannel, lastFromLeadAt: string | null | undefined, now = new Date()): boolean {
  if (channel === 'whatsapp') return true;
  if (!lastFromLeadAt) return false;
  return now.getTime() - new Date(lastFromLeadAt).getTime() < REPLY_WINDOW_HOURS * 3600000;
}
export const windowClosedText = (channel: ChatChannel) =>
  `${CHANNEL_NAME[channel]} only allows a reply within 24 hours of the customer's last message. Wait until they write again.`;

/** The longest text one message may carry on each app (Instagram 1000, Messenger 2000; WhatsApp is split elsewhere). */
export const META_MAX_CHARS: Record<'instagram' | 'messenger', number> = { instagram: 1000, messenger: 2000 };
