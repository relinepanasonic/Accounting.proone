const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/components/reconcile/ReconciliationHUD.tsx');
let code = fs.readFileSync(p, 'utf8');

// 1. Make 'manual' the default tab when activeBankLine changes
code = code.replace(
  /if \(activeBankLine\.amount > 0\) \{\s*setResolutionTab\('income'\);\s*\} else \{\s*setResolutionTab\('expense'\);\s*\}/,
  \setResolutionTab('manual');\
);

// 2. Add Multi-Select functionality
// Replace selectedRecordId with selectedRecordIds
code = code.replace(
  /const \[selectedRecordId, setSelectedRecordId\] = useState<string \| null>\(null\);/,
  \const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);\
);

// 3. Update currentTargetRecordId logic
// I will just redefine currentTargetRecordIds
code = code.replace(
  /const currentTargetRecordId = selectedRecordId \|\| autoMatchRecord\?\.id;/,
  \const currentTargetRecordIds = selectedRecordIds.length > 0 ? selectedRecordIds : (autoMatchRecord ? [autoMatchRecord.id] : []);\
);

// We need to fix all usages of currentTargetRecordId!
// Let's just use string replacement for the specific lines.
