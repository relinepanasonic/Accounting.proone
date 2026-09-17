const fs = require('fs');
let content = fs.readFileSync('src/components/expenses/ExpenseClientTable.tsx', 'utf8');

// 1. Add state for Category dropdown
content = content.replace("const [filterCategory, setFilterCategory] = useState('');", 
`const [filterCategory, setFilterCategory] = useState('');
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [searchCatStr, setSearchCatStr] = useState('');
  const [expandedCatGroups, setExpandedCatGroups] = useState<Record<string, boolean>>({});`);

// 2. Add ChevronDown to lucide-react imports if not there
if (!content.includes('ChevronDown')) {
    content = content.replace('Calendar } from \'lucide-react\'', 'Calendar, ChevronDown, ChevronRight } from \'lucide-react\'');
} else if (!content.includes('ChevronRight')) {
    content = content.replace('ChevronDown } from \'lucide-react\'', 'ChevronDown, ChevronRight } from \'lucide-react\'');
}

// 3. Format Months Helper
content = content.replace("const months = useMemo(() => {", 
`const INDO_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const formatMonthKey = (yyyyMM: string) => {
    if (!yyyyMM) return '';
    const [y, m] = yyyyMM.split('-');
    return \`\${INDO_MONTHS[parseInt(m) - 1]} \${y}\`;
  };

  const groupedCategories = useMemo(() => {
    const groups: Record<string, string[]> = {};
    categories.forEach(c => {
      let type = 'Other';
      if (c.startsWith('4')) type = 'Income';
      else if (c.startsWith('5')) type = 'Cost of Goods Sold';
      else if (c.startsWith('6')) type = 'Operating Expenses';
      else if (c.startsWith('1')) type = 'Assets';
      else if (c.startsWith('2')) type = 'Liabilities';
      else if (c.startsWith('3')) type = 'Equity';
      else if (c.startsWith('7')) type = 'Other Income';
      else if (c.startsWith('8')) type = 'Other Expense';
      if (!groups[type]) groups[type] = [];
      groups[type].push(c);
    });
    return groups;
  }, [categories]);

  const months = useMemo(() => {`);

// 4. Update Month UI
content = content.replace(/<select\s+value=\{filterMonth\}[\s\S]*?<\/select>/, `<select 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] appearance-none"
          >
            <option value="">All Months</option>
            {months.map(m => (
              <option key={m} value={m}>{formatMonthKey(m)}</option>
            ))}
          </select>`);

// 5. Update Category UI
const oldCatUi = /<div className="relative">\s*<Filter className="absolute left-3 top-1\/2 -translate-y-1\/2 w-4 h-4 text-zinc-500" \/>\s*<select\s+value=\{filterCategory\}[\s\S]*?<\/select>\s*<\/div>/;

const newCatUi = `<div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10 pointer-events-none" />
          <input 
            type="text" 
            placeholder="All Categories" 
            value={searchCatStr || filterCategory}
            onChange={(e) => {
              setSearchCatStr(e.target.value);
              setFilterCategory('');
              setCatDropdownOpen(true);
            }}
            onFocus={() => {
              setCatDropdownOpen(true);
              if (!searchCatStr && filterCategory) setSearchCatStr(filterCategory);
            }}
            onBlur={() => setTimeout(() => setCatDropdownOpen(false), 200)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] truncate"
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          
          {catDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] max-h-[300px] overflow-y-auto">
              <div 
                onMouseDown={(e) => { e.preventDefault(); setFilterCategory(''); setSearchCatStr(''); setCatDropdownOpen(false); }}
                className="px-4 py-2.5 text-xs font-bold text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 cursor-pointer border-b border-zinc-800"
              >
                All Categories
              </div>
              
              {Object.entries(groupedCategories).map(([type, cats]) => {
                const filteredCats = cats.filter(c => c.toLowerCase().includes(searchCatStr.toLowerCase()));
                if (filteredCats.length === 0) return null;
                
                const isExpanded = expandedCatGroups[type] !== undefined 
                  ? expandedCatGroups[type] 
                  : (searchCatStr.length > 0 ? true : false);

                return (
                  <div key={type} className="border-b border-zinc-800/50 last:border-0">
                    <div 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setExpandedCatGroups(prev => ({...prev, [type]: !isExpanded}));
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-zinc-900/40 hover:bg-zinc-800/60 cursor-pointer sticky top-0 backdrop-blur-md z-10"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3 text-[#d4af37]" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">{type}</span>
                    </div>
                    {isExpanded && (
                      <div className="py-1">
                        {filteredCats.map(c => (
                          <div
                            key={c}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFilterCategory(c);
                              setSearchCatStr(c);
                              setCatDropdownOpen(false);
                            }}
                            className="px-8 py-2 text-xs text-zinc-300 hover:bg-[#d4af37]/20 hover:text-white cursor-pointer"
                          >
                            {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>`;

content = content.replace(oldCatUi, newCatUi);

fs.writeFileSync('src/components/expenses/ExpenseClientTable.tsx', content);
console.log("Done");
