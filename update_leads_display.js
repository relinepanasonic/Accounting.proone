const fs = require('fs');

// 1. Leads Page
let leadsContent = fs.readFileSync('src/app/sales/leads/page.tsx', 'utf8');
leadsContent = leadsContent.replace(/<NewLeadModal clients=\{clients \|\| \[\]\} \/>/g, '<NewLeadModal />');
leadsContent = leadsContent.replace(/lead\.clients\?\.name/g, 'lead.clients?.name || lead.lead_name');
leadsContent = leadsContent.replace(/<th className="px-6 py-4 font-bold tracking-wider">Client<\/th>/g, '<th className="px-6 py-4 font-bold tracking-wider">Lead Name</th>');
fs.writeFileSync('src/app/sales/leads/page.tsx', leadsContent);

// 2. Kanban Page
let kanbanContent = fs.readFileSync('src/components/sales/PipelineKanban.tsx', 'utf8');
kanbanContent = kanbanContent.replace(/<span className="truncate max-w-\[120px\]">\{deal\.clients\?\.name\}<\/span>/g, '<span className="truncate max-w-[120px]">{deal.clients?.name || deal.lead_name}</span>');
fs.writeFileSync('src/components/sales/PipelineKanban.tsx', kanbanContent);
