const fs = require('fs');

let content = fs.readFileSync('src/components/navigation/CyberSidebar.tsx', 'utf8');

const navGroupsRegex = /interface NavGroup \{[\s\S]*?\];/;

const newNavGroups = `const MAIN_MODULES = [
  { name: 'Accounting', href: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
  { name: 'Sales', href: '/sales', icon: <ArrowUpRight className="w-4 h-4" /> },
  { name: 'Productivity', href: '/productivity', icon: <CheckSquare className="w-4 h-4" /> },
  { name: 'HRD', href: '/payroll', icon: <Users className="w-4 h-4" /> },
  { name: 'System', href: '/settings', icon: <Settings className="w-4 h-4" /> },
];`;

content = content.replace(navGroupsRegex, newNavGroups);

const navBlockRegex = /<nav className="p-3 space-y-4 overflow-y-auto max-h-\[calc\(100vh-140px\)\] scrollbar-hide">[\s\S]*?<\/nav>/;

const newNavBlock = `<nav className="p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-hide">
          {MAIN_MODULES.map((item) => {
            let isActive = false;
            if (item.name === 'Accounting') {
              isActive = ['/', '/invoices', '/expenses', '/assets', '/ledger', '/reconcile'].some(p => pathname === p || pathname.startsWith(p + '/'));
            } else if (item.name === 'HRD') {
              isActive = pathname.startsWith('/payroll') || pathname.startsWith('/hrd');
            } else {
              isActive = pathname.startsWith(item.href);
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={\`group flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 \${
                  isActive
                    ? 'bg-gradient-to-r from-[#d4af37]/20 to-[#d4af37]/5 text-[#f5d77f] border border-[#d4af37]/40 shadow-[0_0_20px_rgba(212,175,55,0.12)]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'
                }\`}
              >
                <div className="flex items-center gap-3">
                  <span className={\`transition-colors \${isActive ? 'text-[#f5d77f]' : 'text-zinc-500 group-hover:text-[#d4af37]'}\`}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="font-sans tracking-wide">
                      {item.name}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>`;

content = content.replace(navBlockRegex, newNavBlock);

fs.writeFileSync('src/components/navigation/CyberSidebar.tsx', content);
console.log('Sidebar updated');
