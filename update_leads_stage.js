const fs = require('fs');
let content = fs.readFileSync('src/app/sales/leads/page.tsx', 'utf8');

// Update Convert to Warm button to set stage to 'Contacted'
content = content.replace(/await updateDealStage\(lead\.id, 'Contact'\);/g, "await updateDealStage(lead.id, 'Contacted');");

fs.writeFileSync('src/app/sales/leads/page.tsx', content);
