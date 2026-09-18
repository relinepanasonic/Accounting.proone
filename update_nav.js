const fs = require('fs');

function replaceInFile(filepath, replacements) {
    let content = fs.readFileSync(filepath, 'utf8');
    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(filepath, content);
}

replaceInFile('src/components/navigation/ModuleSubNav.tsx', [
    { 
      search: /sales: \{\s*match: \['\/sales'\],\s*items: \[\s*\{ name: 'Dashboard', href: '\/sales' \},\s*\{ name: 'Pipeline', href: '\/sales\/pipeline' \},\s*\{ name: 'Customers & Leads', href: '\/sales\/customers' \},\s*\]\s*\}/g, 
      replace: `sales: {
    match: ['/sales'],
    items: [
      { name: 'Dashboard', href: '/sales' },
      { name: 'Leads Database', href: '/sales/leads' },
      { name: 'Pipeline', href: '/sales/pipeline' },
      { name: 'Client', href: '/sales/clients' },
      { name: 'A/R', href: '/sales/ar' },
    ]
  }` 
    }
]);
