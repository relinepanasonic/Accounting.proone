const fs = require('fs');
let content = fs.readFileSync('src/components/navigation/ModuleSubNav.tsx', 'utf8');

const regex = /sales: \{[\s\S]*?\},/g;
const replacement = `sales: {
    match: ['/sales'],
    items: [
      { name: 'Dashboard', href: '/sales' },
      { name: 'Absensi', href: '/sales/absensi' },
      { name: 'To-Do', href: '/sales/todo' },
      { name: 'Leads Database', href: '/sales/leads' },
      { name: 'Pipeline', href: '/sales/pipeline' },
      { name: 'Client', href: '/sales/clients' },
      { name: 'A/R', href: '/sales/ar' },
      { name: 'Reimbursement', href: '/sales/reimbursement' },
    ]
  },`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/navigation/ModuleSubNav.tsx', content);
