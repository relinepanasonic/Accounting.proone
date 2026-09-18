const fs = require('fs');

let content = fs.readFileSync('src/components/sales/PipelineKanban.tsx', 'utf8');

// Update stages
const oldStages = "const STAGES = ['Lead', 'Contact', 'Proposal', 'Negotiation', 'Won', 'Lost'];";
const newStages = "const STAGES = ['Contacted', 'Proposal Sent', 'Negotiation', 'Invoice', 'Deal'];";
content = content.replace(oldStages, newStages);

const oldColors = `const STAGE_COLORS: Record<string, string> = {
  'Lead': 'bg-zinc-400',
  'Contact': 'bg-blue-400',
  'Proposal': 'bg-purple-400',
  'Negotiation': 'bg-amber-400',
  'Won': 'bg-emerald-400',
  'Lost': 'bg-red-400'
};`;
const newColors = `const STAGE_COLORS: Record<string, string> = {
  'Contacted': 'bg-blue-400',
  'Proposal Sent': 'bg-purple-400',
  'Negotiation': 'bg-amber-400',
  'Invoice': 'bg-zinc-400',
  'Deal': 'bg-emerald-400'
};`;
content = content.replace(oldColors, newColors);

fs.writeFileSync('src/components/sales/PipelineKanban.tsx', content);
