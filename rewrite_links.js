const fs = require('fs');
let content = fs.readFileSync('src/components/navigation/CyberSidebar.tsx', 'utf8');

content = content.replace("href: '/sales/customers',", "href: '/sales',");
content = content.replace("href: '/productivity/tasks',", "href: '/productivity',");
content = content.replace("href: '/hrd/employees',", "href: '/hrd',");

fs.writeFileSync('src/components/navigation/CyberSidebar.tsx', content);
