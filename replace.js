const fs = require('fs');
let content = fs.readFileSync('src/components/expenses/ExpenseClientTable.tsx', 'utf8');

const oldUiRegex = /<div className="flex flex-col sm:flex-row gap-3">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const ui = `      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <select 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] appearance-none"
          >
            <option value="">All Months</option>
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] appearance-none truncate"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search Payee..." 
            value={searchPayee}
            onChange={(e) => setSearchPayee(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search Notes..." 
            value={searchNotes}
            onChange={(e) => setSearchNotes(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
          />
        </div>
      </div>`;
content = content.replace(oldUiRegex, ui);

fs.writeFileSync('src/components/expenses/ExpenseClientTable.tsx', content);
console.log("Done");
