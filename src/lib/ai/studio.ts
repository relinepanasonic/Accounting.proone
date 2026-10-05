// AI Studio engine: marketing images for products. Server-side only.
// Flow: the Producer interviews the owner -> brief -> folders -> ONE sample product -> owner approves -> every product
// gets its images, saved back into the owner's Google Drive. `tickStudio` does ONE short step per call (like the office tick).
//
// Roles (all shown as agents of the "Marketing Image Team"):
//   Producer = interview + brief, Drive Scout = folder scan, Researcher = web research (once per job),
//   Prompt Engineer = prompts from the product photo, Image Artist = Gemini image model, Art Director = checks the picture,
//   Delivery = saves to Drive. Video is a later step: its prompt is written now and shown, nothing is generated yet.
import { askBoss, askResearcher, describeModelError, type Pic } from '@/lib/ai/providers';
import { budgetBlocks } from '@/lib/ai/office-extras';
import { driveEnvReady, downloadFile, ensureFolder, isFolder, isImage, listFolder, trashFile, uploadFile, type DriveItem } from '@/lib/ai/drive';
import { generateImage, mediaKeyReady, prepareRef, IMAGE_MODEL, type RefImage } from '@/lib/ai/media';

type Db = any;

const SAMPLE_IMAGES = 2; // the sample shows the first two shots of the sample product
const IMAGES_PER_PRODUCT = 5;
const MAX_PRODUCTS = 60;
const MAX_ATTEMPTS = 2; // first try + one redo when the Art Director rejects the picture
const STALE_MS = 3 * 60 * 1000;

const isMissingTable = (error: any) => error?.code === 'PGRST205' || error?.code === '42P01';
const TABLES_HINT = 'Studio tables are missing. Run supabase/migrations/20261008_ai_studio.sql first.';

export interface StudioBrief {
  product_summary: string;
  selling_points: string[];
  message: string;
  tone: string;
  text_on_image: string;
  language: string;
  style: string;
  dos: string;
  donts: string;
}

// ------------------------------------------------------------------------------------------------ team
const TEAM_SLUG = 'marketing-image-team';

const STUDIO_AGENTS: { name: string; title: string; floor: number; kind: string; provider: string; model: string; enabled: boolean; job_desk: string }[] = [
  { name: 'Mira', title: 'Producer (interviews you, writes the brief)', floor: 3, kind: 'planner', provider: 'anthropic', model: 'claude-sonnet-5-5', enabled: true, job_desk: 'You interview the owner about each product and the message to communicate, then write the creative brief. You run the sample step and wait for approval before the full batch.' },
  { name: 'Dex', title: 'Drive Scout (Studio tool, no AI cost)', floor: 1, kind: 'worker', provider: 'anthropic', model: 'claude-haiku-4-5', enabled: false, job_desk: 'Runs inside the Studio: reads the product photos from the owner Google Drive folder.' },
  { name: 'Rune', title: 'Researcher (market and visual trends)', floor: 2, kind: 'researcher', provider: 'anthropic', model: 'claude-haiku-4-5', enabled: true, job_desk: 'Searches the web once per job for what top marketplace sellers show in their product images and what buyers expect.' },
  { name: 'Pax', title: 'Prompt Engineer (sees the product photo)', floor: 2, kind: 'worker', provider: 'anthropic', model: 'claude-sonnet-5-5', enabled: true, job_desk: 'Looks at the product photo and writes five different square image prompts and one video prompt that keep the product exactly as it is.' },
  { name: 'Nano', title: 'Image Artist (Google Nano Banana, runs in Studio)', floor: 2, kind: 'worker', provider: 'gemini', model: IMAGE_MODEL, enabled: false, job_desk: 'Generates the images from the prompts and the product photo as reference. Runs inside the Studio.' },
  { name: 'Veo', title: 'Video Artist (Google Veo, later step)', floor: 2, kind: 'worker', provider: 'gemini', model: 'veo-3.1', enabled: false, job_desk: 'Will turn the best image into a short product video. Not connected yet.' },
  { name: 'Ada', title: 'Art Director (checks every picture)', floor: 3, kind: 'qc', provider: 'anthropic', model: 'claude-sonnet-5-5', enabled: true, job_desk: 'Compares each generated picture with the product photo: shape, colors, label and logo must match, no garbled text, square, professional. Rejected pictures are redone once.' },
  { name: 'Dru', title: 'Delivery (Studio tool, no AI cost)', floor: 1, kind: 'worker', provider: 'anthropic', model: 'claude-haiku-4-5', enabled: false, job_desk: 'Runs inside the Studio: saves every approved image into the output folder in Google Drive, one folder per product.' },
];

/** The Marketing Image Team (hexagon island + Team Agent page). Safe to call twice. */
export async function ensureStudioTeam(db: Db, workspaceId: string): Promise<string> {
  const { data: existing, error: lookup } = await db.from('ai_teams').select('id').eq('workspace_id', workspaceId).eq('slug', TEAM_SLUG).maybeSingle();
  if (lookup) throw new Error(isMissingTable(lookup) ? 'Team tables are missing. Run supabase/migrations/20260930_ai_teams.sql first.' : lookup.message);
  if (existing) return existing.id as string;

  const { data: team, error } = await db
    .from('ai_teams')
    .insert({
      workspace_id: workspaceId, slug: TEAM_SLUG, name: 'Marketing Image Team',
      mission: 'Turns product photos from Google Drive into square Shopee marketing images, after interviewing the owner and getting a sample approved.',
      workflow: '1. Producer interviews the owner\n2. Pick the Drive folders\n3. Research + prompts for ONE sample product\n4. Owner approves the sample\n5. Images for every product\n6. Saved back to Google Drive',
    })
    .select('id')
    .single();
  if (error) throw new Error(/workflow/.test(error.message) ? 'Run supabase/migrations/20261005_ai_team_blueprint.sql in Supabase first.' : error.message);

  const { data: taken } = await db.from('ai_agents').select('name').eq('workspace_id', workspaceId);
  const used = new Set<string>((taken || []).map((a: { name: string }) => a.name));
  const rows = STUDIO_AGENTS.map((a) => {
    let name = a.name;
    for (let i = 2; used.has(name); i++) name = `${a.name} ${i}`;
    used.add(name);
    return { ...a, name, workspace_id: workspaceId, team_id: team.id };
  });
  const { error: agentError } = await db.from('ai_agents').insert(rows);
  if (agentError) {
    await db.from('ai_teams').delete().eq('id', team.id);
    throw new Error(/job_desk/.test(agentError.message) ? 'Run supabase/migrations/20261005_ai_team_blueprint.sql in Supabase first.' : agentError.message);
  }
  return team.id as string;
}

// ------------------------------------------------------------------------------------------------ jobs
export async function createJob(db: Db, workspaceId: string, userId: string | null, title: string): Promise<string> {
  const teamId = await ensureStudioTeam(db, workspaceId).catch(() => null); // the job works even if the team cannot be made
  const { data, error } = await db
    .from('ai_studio_jobs')
    .insert({ workspace_id: workspaceId, team_id: teamId, title: title.trim().slice(0, 120) || 'Marketing images', created_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(isMissingTable(error) ? TABLES_HINT : error.message);
  return data.id as string;
}

async function loadJob(db: Db, workspaceId: string, jobId: string) {
  const { data, error } = await db.from('ai_studio_jobs').select('*').eq('id', jobId).eq('workspace_id', workspaceId).maybeSingle();
  if (error) throw new Error(isMissingTable(error) ? TABLES_HINT : error.message);
  if (!data) throw new Error('Job not found.');
  return data;
}

const touch = (db: Db, jobId: string, fields: Record<string, unknown>) =>
  db.from('ai_studio_jobs').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', jobId);

// ------------------------------------------------------------------------------------------------ 1. interview
const INTERVIEW_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'What the Producer says to the owner now: the next questions, or the summary of the brief.' },
    ready: { type: 'boolean', description: 'True only when the owner has answered enough to write a good brief.' },
    brief: {
      type: 'object',
      description: 'Fill every field when ready; otherwise empty strings and an empty list.',
      properties: {
        product_summary: { type: 'string' },
        selling_points: { type: 'array', items: { type: 'string' } },
        message: { type: 'string', description: 'The communication the images should say.' },
        tone: { type: 'string' },
        text_on_image: { type: 'string', description: '"none", or exactly what short text may appear and where.' },
        language: { type: 'string' },
        style: { type: 'string', description: 'Look and mood: backgrounds, colors, props.' },
        dos: { type: 'string' },
        donts: { type: 'string' },
      },
      required: ['product_summary', 'selling_points', 'message', 'tone', 'text_on_image', 'language', 'style', 'dos', 'donts'],
      additionalProperties: false,
    },
  },
  required: ['reply', 'ready', 'brief'],
  additionalProperties: false,
};

const PRODUCER_SYSTEM =
  'You are Mira, Producer of the Marketing Image Team. You interview the owner of an Indonesian e-commerce agency before any image is made. ' +
  'The output is square (1:1) Shopee marketing images, 5 per product, plus one short product video later. ' +
  'Ask at most 4 short questions per message, and only what you still need. Cover: what the product is and who buys it; the 2 to 4 selling points; the message or communication the images must say; ' +
  'the tone (premium, fun, clean...); whether any text may appear on the image and in which language (AI draws text badly, so recommend a few short words at most, or none, and say text can be added afterwards); ' +
  'the look (backgrounds, colors, props, people yes or no); things that must or must not appear. ' +
  'If the owner has many products, ask whether one brief fits all or what differs. Never invent product facts. Write in the language the owner writes in (start in English). ' +
  'When you have enough, set ready to true, fill the brief, and in your reply summarize it in 5 short lines and ask the owner to confirm or correct. If the owner corrects something, update the brief.';

/** One turn of the interview. `ownerMessage` null = the Producer opens the interview. */
export async function interviewTurn(db: Db, workspaceId: string, jobId: string, ownerMessage: string | null) {
  const job = await loadJob(db, workspaceId, jobId);
  if (!['interview', 'briefed'].includes(job.status)) throw new Error('The interview is over for this job.');
  const log: { role: 'producer' | 'owner'; text: string }[] = Array.isArray(job.interview) ? job.interview : [];
  if (ownerMessage && ownerMessage.trim()) log.push({ role: 'owner', text: ownerMessage.trim().slice(0, 4000) });

  const transcript = log.map((m) => `${m.role === 'owner' ? 'Owner' : 'Mira'}: ${m.text}`).join('\n\n');
  const { data } = await askBoss<{ reply: string; ready: boolean; brief: StudioBrief }>({
    deep: false,
    effort: 'low',
    system: PRODUCER_SYSTEM,
    prompt: log.length ? `Interview so far:\n\n${transcript}\n\nWrite Mira's next message.` : 'The interview starts now. Write Mira\'s opening message: greet briefly and ask the first questions.',
    schema: INTERVIEW_SCHEMA,
  });

  log.push({ role: 'producer', text: data.reply });
  await touch(db, jobId, { interview: log, brief: data.ready ? data.brief : job.brief, status: data.ready ? 'briefed' : 'interview' });
  return { ready: data.ready };
}

// ------------------------------------------------------------------------------------------------ 2. folders -> products
const stripExt = (n: string) => n.replace(/\.[^.]+$/, '');
const safeName = (n: string) => n.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'product';

/**
 * Subfolders of the input folder = one product each (its photos inside). Loose photos in the folder = one product each.
 * Replaces the product list of the job.
 */
export async function scanInput(db: Db, workspaceId: string, jobId: string): Promise<number> {
  const job = await loadJob(db, workspaceId, jobId);
  if (!job.input_folder_id) throw new Error('Choose the input folder first.');
  if (!job.output_folder_id) throw new Error('Choose the output folder first.');

  const items = await listFolder(db, workspaceId, job.input_folder_id);
  const products: { name: string; files: DriveItem[] }[] = [];
  for (const f of items.filter(isFolder).slice(0, MAX_PRODUCTS)) {
    const files = (await listFolder(db, workspaceId, f.id)).filter(isImage).slice(0, 4);
    if (files.length) products.push({ name: f.name, files });
  }
  for (const f of items.filter(isImage)) {
    if (products.length >= MAX_PRODUCTS) break;
    products.push({ name: stripExt(f.name), files: [f] });
  }
  if (products.length === 0) throw new Error('No product photos found. Put JPG, PNG or WebP photos in the folder (one subfolder per product, or one photo per product).');

  await db.from('ai_studio_products').delete().eq('job_id', jobId);
  const { error } = await db.from('ai_studio_products').insert(
    products.map((p, i) => ({ job_id: jobId, workspace_id: workspaceId, name: p.name, source_files: p.files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })), is_sample: i === 0 }))
  );
  if (error) throw new Error(error.message);
  return products.length;
}

export async function setFolders(db: Db, workspaceId: string, jobId: string, input: { id: string; name: string }, output: { id: string; name: string }) {
  await loadJob(db, workspaceId, jobId);
  if (input.id === output.id) throw new Error('Use two different folders: one for the product photos, one for the results.');
  await touch(db, jobId, { input_folder_id: input.id, input_folder_name: input.name, output_folder_id: output.id, output_folder_name: output.name });
}

/** Which product is the sample: the owner may pick another one before starting. */
export async function chooseSample(db: Db, workspaceId: string, jobId: string, productId: string) {
  await loadJob(db, workspaceId, jobId);
  await db.from('ai_studio_products').update({ is_sample: false }).eq('job_id', jobId);
  await db.from('ai_studio_products').update({ is_sample: true }).eq('id', productId).eq('job_id', jobId);
}

export async function startSample(db: Db, workspaceId: string, jobId: string) {
  const job = await loadJob(db, workspaceId, jobId);
  if (!job.brief) throw new Error('Finish the interview first.');
  if (!driveEnvReady() || !mediaKeyReady()) throw new Error('Google Drive and the Gemini key must be set up first.');
  const { count } = await db.from('ai_studio_products').select('id', { count: 'exact', head: true }).eq('job_id', jobId);
  if (!count) throw new Error('Scan the input folder first.');
  if (await budgetBlocks(db, workspaceId)) throw new Error('The monthly AI budget is used up.');
  await touch(db, jobId, { status: 'sampling', error: null });
}

export async function approveSample(db: Db, workspaceId: string, jobId: string) {
  const job = await loadJob(db, workspaceId, jobId);
  if (job.status !== 'review') throw new Error('There is no sample waiting for approval.');
  await touch(db, jobId, { status: 'generating', feedback: null, error: null });
}

/** The owner wants changes: the sample pictures are removed from Drive and made again with the remarks. */
export async function reviseSample(db: Db, workspaceId: string, jobId: string, feedback: string) {
  const job = await loadJob(db, workspaceId, jobId);
  if (job.status !== 'review') throw new Error('There is no sample to revise.');
  const text = feedback.trim().slice(0, 1500);
  if (text.length < 3) throw new Error('Write what should change.');
  const { data: assets } = await db.from('ai_studio_assets').select('id, drive_file_id').eq('job_id', jobId);
  for (const a of assets || []) if (a.drive_file_id) await trashFile(db, workspaceId, a.drive_file_id).catch(() => {});
  await db.from('ai_studio_assets').delete().eq('job_id', jobId);
  await db.from('ai_studio_products').update({ prompts: null, status: 'pending', error: null }).eq('job_id', jobId);
  await touch(db, jobId, { status: 'sampling', feedback: text, error: null });
}

/** After a failure, or when some pictures failed: put them back in the queue and carry on. */
export async function resumeJob(db: Db, workspaceId: string, jobId: string) {
  const job = await loadJob(db, workspaceId, jobId);
  if (!['failed', 'done'].includes(job.status)) return;
  const { data: failed } = await db.from('ai_studio_assets').select('id').eq('job_id', jobId).eq('status', 'failed');
  if (job.status === 'done' && !failed?.length) return;
  const { count } = await db.from('ai_studio_assets').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('is_sample', false);
  await db.from('ai_studio_assets').update({ status: 'queued', attempts: 0, error: null }).eq('job_id', jobId).eq('status', 'failed');
  await db.from('ai_studio_products').update({ status: 'pending', error: null }).eq('job_id', jobId).eq('status', 'failed');
  await touch(db, jobId, { status: count || job.status === 'done' ? 'generating' : 'sampling', error: null });
}

// ------------------------------------------------------------------------------------------------ 3. one step at a time
const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    product_description: { type: 'string', description: 'What the product looks like: shape, colors, label text, logo. Used to check the pictures.' },
    images: { type: 'array', items: { type: 'string' }, description: 'Exactly 5 image prompts, one per shot.' },
    video: { type: 'string', description: 'One image-to-video prompt for a 6 to 8 second clip.' },
  },
  required: ['product_description', 'images', 'video'],
  additionalProperties: false,
};

const ENGINEER_SYSTEM =
  'You are Pax, Prompt Engineer of the Marketing Image Team. You see the product photo(s). Write 5 image prompts for an AI image model that receives the same photo(s) as reference, plus one video prompt. ' +
  'All images are SQUARE 1:1 for Shopee. The five shots must differ: 1) hero main image: product centered, clean light background, marketplace-ready; 2) lifestyle: the product in real use, natural light; ' +
  '3) close-up of the most attractive detail or texture; 4) benefit scene with calm empty space for text to be added later; 5) styled flat lay or composition with fitting props. ' +
  'EVERY image prompt must say that the product stays exactly as in the reference photo: same shape, proportions, colors, label and logo, nothing redrawn or invented. ' +
  'Do not ask the model to render any text, prices, badges or watermarks unless the brief names a short exact text; if it does, quote it exactly. ' +
  'Prompts are written in English, concrete (camera, lens feel, light, background, props, mood), 40 to 90 words each. The video prompt describes one smooth camera move from the hero shot (6 to 8 seconds), no text.';

async function pics(db: Db, workspaceId: string, files: { id: string }[], max: number): Promise<{ pics: Pic[]; refs: RefImage[] }> {
  const refs: RefImage[] = [];
  for (const f of files.slice(0, max)) {
    const { data } = await downloadFile(db, workspaceId, f.id);
    refs.push(await prepareRef(data));
  }
  return { refs, pics: refs.map((r) => ({ mediaType: 'image/jpeg' as const, data: r.data })) };
}

async function researchStep(db: Db, job: any) {
  const brief: StudioBrief = job.brief;
  const out = await askResearcher({
    model: 'claude-haiku-4-5',
    system: 'You are Rune, researcher of the Marketing Image Team. Use at most 2 web searches. Answer in under 180 words, plain text, no Markdown.',
    prompt: `Product: ${brief.product_summary}\nSelling points: ${brief.selling_points.join('; ')}\nFor the Indonesian marketplace (Shopee): what do the best-selling listings in this category show in their main and secondary product images (backgrounds, props, angles, text badges), and what do buyers expect to see? Give 5 concrete visual observations.`,
    maxSearches: 2,
  });
  await touch(db, job.id, { research: out.text.slice(0, 2500) });
}

async function promptStep(db: Db, job: any, product: any) {
  const brief: StudioBrief = job.brief;
  const { pics: photos } = await pics(db, job.workspace_id, product.source_files, 2);
  const { data } = await askBoss<{ product_description: string; images: string[]; video: string }>({
    deep: false,
    effort: 'low',
    system: ENGINEER_SYSTEM,
    prompt:
      `Product name: ${product.name}\n\nCreative brief from the owner:\n${JSON.stringify(brief, null, 2)}\n\n` +
      (job.research ? `Market research:\n${job.research}\n\n` : '') +
      (job.feedback ? `The owner reviewed the last sample and wants this changed (follow it):\n${job.feedback}\n\n` : '') +
      'The reference photo(s) of the product are attached.',
    schema: PROMPT_SCHEMA,
    images: photos,
  });
  const images = (data.images || []).filter((s) => s && s.trim()).slice(0, IMAGES_PER_PRODUCT);
  if (images.length < IMAGES_PER_PRODUCT) throw new Error('The prompt engineer returned fewer than 5 prompts.');
  await db.from('ai_studio_products').update({ prompts: { images, video: data.video, description: data.product_description }, status: 'prompted', error: null }).eq('id', product.id);
}

const QC_SCHEMA = {
  type: 'object',
  properties: { pass: { type: 'boolean' }, note: { type: 'string', description: 'If rejected: exactly what is wrong. If passed: one short line.' } },
  required: ['pass', 'note'],
  additionalProperties: false,
};

/** Ada, the Art Director: does the generated picture still show THE product? */
async function artDirector(description: string, ref: Pic, generated: Pic): Promise<{ pass: boolean; note: string }> {
  const { data } = await askBoss<{ pass: boolean; note: string }>({
    deep: false,
    effort: 'low',
    system:
      'You are Ada, Art Director. Image 1 is the real product photo. Image 2 is an AI-made marketing picture. Reject image 2 only for a real problem: the product changed (shape, proportions, colors, label, logo, packaging text), ' +
      'garbled or invented text, extra or missing parts, anatomy or physics errors, not square, watermark, or low quality. A different background, light or props is expected and fine.',
    prompt: `What the product looks like: ${description || '(see image 1)'}\nDecide.`,
    schema: QC_SCHEMA,
    images: [ref, generated],
  });
  return data;
}

async function ensureProductFolder(db: Db, job: any, product: any): Promise<string> {
  if (product.drive_folder_id) return product.drive_folder_id;
  const id = await ensureFolder(db, job.workspace_id, safeName(product.name), job.output_folder_id);
  await db.from('ai_studio_products').update({ drive_folder_id: id }).eq('id', product.id);
  product.drive_folder_id = id;
  return id;
}

async function makeAsset(db: Db, job: any, product: any, asset: any) {
  const prompts = product.prompts;
  const prompt: string = prompts?.images?.[asset.idx];
  if (!prompt) throw new Error('No prompt for this picture.');

  const { pics: photos, refs } = await pics(db, job.workspace_id, product.source_files, 2);
  const retryNote = asset.qc_note && asset.attempts > 1 ? `\n\nThe previous try was rejected by the art director: ${asset.qc_note}. Fix exactly that.` : '';
  const full = `${prompt}${retryNote}\n\nRules: square 1:1 image. Keep the product identical to the reference photo(s): same shape, colors, label and logo. No watermark. No extra text unless quoted above.`;

  const img = await generateImage({ prompt: full, refs });
  const generated = await prepareRef(img.data); // the check sees a normal-sized JPEG
  const verdict = await artDirector(prompts?.description || '', photos[0], { mediaType: 'image/jpeg', data: generated.data });

  if (!verdict.pass && asset.attempts < MAX_ATTEMPTS) {
    await db.from('ai_studio_assets').update({ status: 'queued', qc_note: verdict.note.slice(0, 400), cost_usd: Number(asset.cost_usd || 0) + img.costUsd, updated_at: new Date().toISOString() }).eq('id', asset.id);
    return;
  }

  const folderId = await ensureProductFolder(db, job, product);
  const ext = img.mimeType.includes('jpeg') ? 'jpg' : 'png';
  const fileName = `${safeName(product.name)}-${asset.idx + 1}.${ext}`;
  const fileId = await uploadFile(db, job.workspace_id, { name: fileName, mimeType: img.mimeType, data: img.data, parentId: folderId });
  await db.from('ai_studio_assets').update({
    status: 'done', drive_file_id: fileId, drive_file_name: fileName, error: null,
    qc_note: verdict.pass ? verdict.note.slice(0, 400) : `Accepted after retry with a warning: ${verdict.note}`.slice(0, 400),
    cost_usd: Number(asset.cost_usd || 0) + img.costUsd, updated_at: new Date().toISOString(),
  }).eq('id', asset.id);
}

/** Queues the picture rows a product still needs. */
async function queueAssets(db: Db, job: any, product: any, count: number, isSample: boolean) {
  const { data: have } = await db.from('ai_studio_assets').select('idx').eq('product_id', product.id).eq('kind', 'image');
  const taken = new Set((have || []).map((a: any) => a.idx));
  const rows = [];
  for (let i = 0; i < count; i++) {
    if (taken.has(i)) continue;
    rows.push({ job_id: job.id, product_id: product.id, workspace_id: job.workspace_id, kind: 'image', idx: i, prompt: product.prompts.images[i], is_sample: isSample && i < SAMPLE_IMAGES });
  }
  if (rows.length) await db.from('ai_studio_assets').insert(rows);
  return rows.length;
}

async function stepJob(db: Db, workspaceId: string, job: any): Promise<void> {
  const { data: products } = await db.from('ai_studio_products').select('*').eq('job_id', job.id).order('created_at');
  const list: any[] = products || [];
  const sample = list.find((p) => p.is_sample) || list[0];
  if (!sample) throw new Error('This job has no products. Scan the input folder again.');

  // stale "running" pictures (function timed out) go back in the queue
  await db.from('ai_studio_assets').update({ status: 'queued' }).eq('job_id', job.id).eq('status', 'running').lt('updated_at', new Date(Date.now() - STALE_MS).toISOString());

  if (!job.research) {
    // Research is a bonus: if the web search fails the team goes on without it.
    try {
      return await researchStep(db, job);
    } catch {
      await touch(db, job.id, { research: '(no market research available)' });
      return;
    }
  }

  if (job.status === 'sampling') {
    if (!sample.prompts) return promptStep(db, job, sample);
    const added = await queueAssets(db, job, sample, SAMPLE_IMAGES, true);
    if (added) return;
    const { data: next } = await db.from('ai_studio_assets').select('*').eq('product_id', sample.id).eq('status', 'queued').order('idx').limit(1);
    if (next?.[0]) return runAsset(db, job, sample, next[0]);
    await touch(db, job.id, { status: 'review' });
    return;
  }

  // generating: every product gets its prompts, then its five pictures (the sample keeps the ones it already has)
  const needPrompt = list.find((p) => !p.prompts && p.status !== 'failed');
  if (needPrompt) {
    try {
      return await promptStep(db, job, needPrompt);
    } catch (err) {
      await db.from('ai_studio_products').update({ status: 'failed', error: describeModelError(err).slice(0, 300) }).eq('id', needPrompt.id);
      return;
    }
  }
  for (const p of list) {
    if (p.prompts && p.status !== 'failed') {
      const added = await queueAssets(db, job, p, IMAGES_PER_PRODUCT, p.id === sample.id);
      if (added) return;
    }
  }
  const { data: next } = await db.from('ai_studio_assets').select('*').eq('job_id', job.id).eq('status', 'queued').order('created_at').limit(1);
  if (next?.[0]) return runAsset(db, job, list.find((p) => p.id === next[0].product_id), next[0]);

  const { data: open } = await db.from('ai_studio_assets').select('id').eq('job_id', job.id).in('status', ['queued', 'running']).limit(1);
  if (!open?.length) {
    await db.from('ai_studio_products').update({ status: 'done' }).eq('job_id', job.id).eq('status', 'prompted');
    await touch(db, job.id, { status: 'done' });
  }
}

async function runAsset(db: Db, job: any, product: any, asset: any) {
  const { data: claimed } = await db
    .from('ai_studio_assets')
    .update({ status: 'running', attempts: asset.attempts + 1, updated_at: new Date().toISOString() })
    .eq('id', asset.id).eq('status', 'queued').select('id');
  if (!claimed?.length) return; // another call got it
  try {
    await makeAsset(db, job, product, { ...asset, attempts: asset.attempts + 1 });
  } catch (err) {
    const message = describeModelError(err).slice(0, 300);
    const final = asset.attempts + 1 >= MAX_ATTEMPTS;
    await db.from('ai_studio_assets').update({ status: final ? 'failed' : 'queued', error: message, updated_at: new Date().toISOString() }).eq('id', asset.id);
  }
}

/** One short step of studio work. Returns whether a job is still running. */
export async function tickStudio(db: Db, workspaceId: string): Promise<{ active: boolean; error?: string }> {
  const { data: jobs, error } = await db.from('ai_studio_jobs').select('*').eq('workspace_id', workspaceId).in('status', ['sampling', 'generating']).order('created_at').limit(1);
  if (error) return { active: false };
  const job = jobs?.[0];
  if (!job) return { active: false };

  try {
    if (await budgetBlocks(db, workspaceId)) throw new Error('The monthly AI budget is used up.');
    await stepJob(db, workspaceId, job);
  } catch (err) {
    const message = describeModelError(err).slice(0, 400);
    await touch(db, job.id, { status: 'failed', error: message });
    return { active: false, error: message };
  }
  const { data: still } = await db.from('ai_studio_jobs').select('status').eq('id', job.id).maybeSingle();
  return { active: ['sampling', 'generating'].includes(still?.status) };
}

// ------------------------------------------------------------------------------------------------ state for the screen
export async function getStudioState(db: Db, workspaceId: string, jobId: string | null) {
  const { data: integ, error: integError } = await db.from('ai_integrations').select('account_email').eq('workspace_id', workspaceId).eq('provider', 'google_drive').maybeSingle();
  const tables = !integError || !isMissingTable(integError);
  const setup = {
    tables,
    driveEnv: driveEnvReady(),
    driveConnected: Boolean(integ),
    driveEmail: (integ?.account_email as string | undefined) || null,
    geminiKey: mediaKeyReady(),
    imageModel: IMAGE_MODEL,
  };
  if (!tables) return { setup, jobs: [], job: null };

  const { data: jobs } = await db.from('ai_studio_jobs').select('id, title, status, created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(30);
  const id = jobId || jobs?.[0]?.id || null;
  if (!id) return { setup, jobs: jobs || [], job: null };

  const job = await loadJob(db, workspaceId, id);
  const [{ data: products }, { data: assets }] = await Promise.all([
    db.from('ai_studio_products').select('id, name, source_files, prompts, is_sample, status, error').eq('job_id', id).order('created_at'),
    db.from('ai_studio_assets').select('id, product_id, kind, idx, prompt, status, attempts, drive_file_id, drive_file_name, is_sample, cost_usd, qc_note, error').eq('job_id', id).order('idx'),
  ]);
  const cost = (assets || []).reduce((s: number, a: any) => s + Number(a.cost_usd || 0), 0);
  return { setup, jobs: jobs || [], job: { ...job, products: products || [], assets: assets || [], cost } };
}
