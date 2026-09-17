const fs = require('fs');

let content = fs.readFileSync('src/components/navigation/CyberSidebar.tsx', 'utf8');

const navItemsRegex = /const NAV_ITEMS: NavItem\[\] = \[\s*\{[\s\S]*?\];/;

const newNavGroups = `interface NavGroup {
  groupName: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'Accounting',
    items: [
      {
        name: 'Dashboard',
        href: '/',
        icon: <LayoutDashboard className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'accounting'],
      },
      {
        name: 'Income',
        href: '/invoices',
        icon: <ArrowDownLeft className="w-4 h-4" />,
        badge: 'Sales',
        allowedRoles: ['founder', 'superadmin', 'accounting', 'admin'],
      },
      {
        name: 'Tax / Pajak',
        href: '/invoices/tax',
        icon: <ShieldCheck className="w-4 h-4" />,
        badge: 'Doc',
        allowedRoles: ['founder', 'superadmin', 'accounting', 'admin'],
        allowedWorkspaceIds: ['11111111-1111-1111-1111-111111111111'],
      },
      {
        name: 'Expenses',
        href: '/expenses',
        icon: <ArrowUpRight className="w-4 h-4" />,
        badge: 'Bills',
        allowedRoles: ['founder', 'superadmin', 'accounting', 'admin'],
      },
      {
        name: 'Assets',
        href: '/assets',
        icon: <Box className="w-4 h-4" />,
        badge: 'Deprec.',
        allowedRoles: ['founder', 'superadmin', 'accounting'],
      },
      {
        name: 'Activity Ledger',
        href: '/ledger',
        icon: <BookOpen className="w-4 h-4" />,
        badge: 'Live',
        allowedRoles: ['founder', 'superadmin', 'accounting'],
      },
      {
        name: 'Bank Reconcile',
        href: '/reconcile',
        icon: <CheckSquare className="w-4 h-4" />,
        badge: 'Match',
        allowedRoles: ['founder', 'superadmin', 'accounting'],
      },
    ]
  },
  {
    groupName: 'Sales',
    items: [
      {
        name: 'Customers & Leads',
        href: '/sales/customers',
        icon: <Users className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'admin', 'sales'],
      },
      {
        name: 'CRM Pipeline',
        href: '/sales/pipeline',
        icon: <LayoutDashboard className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'admin', 'sales'],
      },
    ]
  },
  {
    groupName: 'Productivity',
    items: [
      {
        name: 'Task Board',
        href: '/productivity/tasks',
        icon: <CheckSquare className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'admin', 'employee'],
      },
      {
        name: 'Docs & Wiki',
        href: '/productivity/docs',
        icon: <FileText className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'admin', 'employee'],
      },
    ]
  },
  {
    groupName: 'HRD',
    items: [
      {
        name: 'Team Payroll',
        href: '/payroll',
        icon: <Users className="w-4 h-4" />,
        badge: 'Salaries',
        allowedRoles: ['founder', 'superadmin', 'accounting', 'hr'],
      },
      {
        name: 'Employee Directory',
        href: '/hrd/employees',
        icon: <BookOpen className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'hr'],
      },
    ]
  },
  {
    groupName: 'System',
    items: [
      {
        name: 'Settings & Users',
        href: '/settings',
        icon: <Settings className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin'],
      },
    ]
  }
];`;

content = content.replace(navItemsRegex, newNavGroups);

if (!content.includes('ChevronDown')) {
  content = content.replace('ChevronRight,', 'ChevronRight,\n  ChevronDown,');
}

const navBlockRegex = /<nav className="p-3 space-y-1">[\s\S]*?<\/nav>/;

const newNavBlock = `<nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-hide">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => {
              if (!item.allowedRoles.includes(activeRole)) return false;
              if (item.allowedWorkspaceIds && !item.allowedWorkspaceIds.includes(activeId)) return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.groupName} className="flex flex-col space-y-1">
                {!isCollapsed && (
                  <div className="px-3 py-1 mb-1 text-[10px] font-extrabold tracking-widest text-zinc-500 uppercase">
                    {group.groupName}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={\`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 \${
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
                      {!isCollapsed && item.badge && (
                        <span className={\`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider \${isActive ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'bg-zinc-800 text-zinc-400 group-hover:bg-[#d4af37]/10 group-hover:text-[#f5d77f]'}\`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>`;

content = content.replace(navBlockRegex, newNavBlock);

fs.writeFileSync('src/components/navigation/CyberSidebar.tsx', content);
console.log('Sidebar updated');
