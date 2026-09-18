const fs = require('fs');
let content = fs.readFileSync('src/components/sales/PipelineKanban.tsx', 'utf8');

// Replace export function PipelineKanban
const oldFunc = "export function PipelineKanban({ initialDeals, clients }: { initialDeals: any[], clients: any[] }) {";
const newFunc = `import { useRouter, useSearchParams } from 'next/navigation';

export function PipelineKanban({ initialDeals, clients, currentMonth }: { initialDeals: any[], clients: any[], currentMonth: string }) {
  const router = useRouter();`;
content = content.replace(oldFunc, newFunc);

// Replace header
const oldHeader = `<div className="flex justify-between items-center mb-6 px-4 lg:px-8 shrink-0 mt-4">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">CRM Pipeline</h1>
            <p className="text-sm text-zinc-400 mt-1">Drag and drop deals, or use arrows to manage opportunities.</p>
          </div>
        </div>`;
const newHeader = `<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 px-4 lg:px-8 shrink-0 mt-4">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">CRM Pipeline</h1>
            <p className="text-sm text-zinc-400 mt-1">Drag and drop deals, or use arrows to manage opportunities.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-zinc-400">Pipeline Month:</label>
            <input 
              type="month" 
              value={currentMonth}
              onChange={(e) => {
                if (e.target.value) {
                  router.push(\`/sales/pipeline?month=\${e.target.value}\`);
                }
              }}
              className="bg-[#0e0f14] border border-[#d4af37]/30 text-zinc-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#d4af37] [color-scheme:dark]"
            />
          </div>
        </div>`;
content = content.replace(oldHeader, newHeader);

fs.writeFileSync('src/components/sales/PipelineKanban.tsx', content);
