// Pure module (no next/headers): the only people who may edit or delete Buku Bank lines. Lowercase emails.
const BANK_BOOK_EDITORS = ['nicojapar@gmail.com', 'lucyana.suryaputra@gmail.com'];

export const canEditBankBook = (email?: string | null) => !!email && BANK_BOOK_EDITORS.includes(email.trim().toLowerCase());
