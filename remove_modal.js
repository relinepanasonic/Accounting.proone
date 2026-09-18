const fs = require('fs');
let content = fs.readFileSync('src/components/sales/PipelineKanban.tsx', 'utf8');

// Remove import
content = content.replace("import { NewDealModal } from './NewDealModal';", "");

// Remove component usage
content = content.replace("<NewDealModal clients={clients} />", "");

fs.writeFileSync('src/components/sales/PipelineKanban.tsx', content);
