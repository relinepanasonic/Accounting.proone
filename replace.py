import re

with open("src/components/expenses/ExpenseClientTable.tsx", "r") as f:
    content = f.read()

# Add searchNotes
content = content.replace("const [searchPayee, setSearchPayee] = useState('');", "const [searchPayee, setSearchPayee] = useState('');\n  const [searchNotes, setSearchNotes] = useState('');")

# Update logic
logic = """      if (searchPayee && !r.vendor.toLowerCase().includes(searchPayee.toLowerCase())) return false;
      if (searchNotes && !r.notes.toLowerCase().includes(searchNotes.toLowerCase())) return false;
      if (filterMonth && !r.date.startsWith(filterMonth)) return false;
      if (filterCategory && r.category !== filterCategory) return false;"""

content = re.sub(
    r"if \(searchPayee && !r\.vendor\.toLowerCase\(\)\.includes\(searchPayee\.toLowerCase\(\)\) && !r\.notes\.toLowerCase\(\)\.includes\(searchPayee\.toLowerCase\(\)\)\) return false;\s*if \(filterMonth && !r\.date\.startsWith\(filterMonth\)\) return false;\s*if \(filterCategory && r\.category !== filterCategory\) return false;",
    logic,
    content
)

# Update UI
ui = """      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
      </div>"""

content = re.sub(
    r'<div className="flex flex-col md:flex-row gap-4 mb-6">.*?</div>\s*</div>\s*</div>',
    ui,
    content,
    flags=re.DOTALL
)

with open("src/components/expenses/ExpenseClientTable.tsx", "w") as f:
    f.write(content)
print("Done")
