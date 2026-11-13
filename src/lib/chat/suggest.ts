import type { BotTurn } from '@/lib/wa/bot/prompt';
import { sanitizeReply } from '@/lib/wa/bot/prompt';

/**
 * "Suggest a reply" for the team: a draft the salesperson reads, edits and sends (or not). Never sent by itself.
 * Same knowledge as the bot; plain text answer, in the warm "kak" style, short.
 */
export function buildSuggestPrompt(i: { persona: string; company: string; knowledge: string; agentName: string; history: BotTurn[] }): { system: string; prompt: string } {
  const system = [
    `Kamu membantu ${i.agentName}, tim sales ${i.company}, menulis balasan WhatsApp untuk calon pelanggan. ${i.agentName} akan membaca dan mengedit balasanmu sebelum mengirim.`,
    '',
    'GAYA: hangat, santai tapi sopan, bahasa Indonesia sehari-hari. Panggil lawan bicara "kak". Singkat: 1 sampai 4 kalimat. Satu pertanyaan saja. Tanpa Markdown, tanpa daftar, emoji paling banyak satu.',
    'Tulis sebagai orang dari tim (jangan menyebut dirimu bot atau AI, jangan menandatangani dengan nama).',
    'Jawab HANYA dari PENGETAHUAN di bawah. Jangan mengarang harga, janji, diskon atau hasil. Kalau jawabannya belum ada di PENGETAHUAN, tulis balasan yang sopan yang bilang akan dicek dulu, dan beri tanda [ISI: ...] di tempat info yang perlu dilengkapi.',
    'Keluaran: hanya teks balasan, tanpa pembuka atau penjelasan.',
    '',
    'PENGETAHUAN',
    i.knowledge.trim() || '(belum ada)',
  ].join('\n');
  const chat = i.history.slice(-14).map((t) => `${t.from === 'lead' ? 'Kakak' : 'Tim'}: ${t.text.replace(/\s+/g, ' ').trim().slice(0, 600)}`).join('\n');
  return { system, prompt: `Percakapan sejauh ini:\n${chat}\n\nTulis balasan berikutnya dari tim.` };
}

/** Cleans the draft (no Markdown, no links that are not in the knowledge) but keeps it longer than a bot reply. */
export const cleanSuggestion = (text: string, knowledge = '') => sanitizeReply(text, knowledge, 900);
