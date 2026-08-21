const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/components/reconcile/ReconciliationHUD.tsx');
let code = fs.readFileSync(p, 'utf8');

// const isHighlighted = rec.id === currentTargetRecordId;
code = code.replace(/const isHighlighted = rec\.id === currentTargetRecordId;/g, 'const isHighlighted = currentTargetRecordIds.includes(rec.id);');

// onClick={() => setSelectedRecordId(rec.id)}
code = code.replace(/onClick=\{.*?setSelectedRecordId\(rec\.id\)\}/g, 'onClick={() => setSelectedRecordIds(prev => prev.includes(rec.id) ? prev.filter(id => id !== rec.id) : [...prev, rec.id])}');

// setSelectedRecordId(rec.id); in the inline button
code = code.replace(/setSelectedRecordId\(rec\.id\);/g, 'setSelectedRecordIds([rec.id]);');

// disabled={!currentTargetRecordId || isPending}
code = code.replace(/disabled=\{!currentTargetRecordId \|\| isPending\}/g, 'disabled={currentTargetRecordIds.length === 0 || isPending}');
code = code.replace(/disabled=\{!activeBankLine \|\| !currentTargetRecordId \|\| isPending\}/g, 'disabled={!activeBankLine || currentTargetRecordIds.length === 0 || isPending}');

// (activeBankLine && currentTargetRecordId && Math.abs(recordsList.find(r => r.id === currentTargetRecordId)?.amount || 0) !== Math.abs(activeBankLine.amount))
const conditionRegex = /\(activeBankLine && currentTargetRecordId && Math\.abs\(recordsList\.find\(r => r\.id === currentTargetRecordId\)\?\.amount \|\| 0\) !== Math\.abs\(activeBankLine\.amount\)\)/g;
code = code.replace(conditionRegex, '(activeBankLine && currentTargetRecordIds.length > 0 && Math.abs(recordsList.filter(r => currentTargetRecordIds.includes(r.id)).reduce((sum, r) => sum + r.amount, 0)) !== Math.abs(activeBankLine.amount))');

// if (!activeBankLine || !currentTargetRecordId) return <span>SELECT BANK & SYSTEM RECORD</span>;
// const rec = recordsList.find(r => r.id === currentTargetRecordId);
const recRegex = /if \(!activeBankLine \|\| !currentTargetRecordId\) return <span>SELECT BANK & SYSTEM RECORD<\/span>;\s*const rec = recordsList\.find\(r => r\.id === currentTargetRecordId\);/g;
code = code.replace(recRegex, \
if (!activeBankLine || currentTargetRecordIds.length === 0) return <span>SELECT BANK & SYSTEM RECORD</span>;
const recAmounts = recordsList.filter(r => currentTargetRecordIds.includes(r.id)).reduce((sum, r) => sum + Math.abs(r.amount), 0);
\);

// <span>MATCH {rec?.type?.toUpperCase() || 'RECORD'}</span>
code = code.replace(/<span>MATCH \{rec\?\.type\?\.toUpperCase\(\) \|\| 'RECORD'\}<\/span>/g, \<span>MATCH \</span>\);

fs.writeFileSync(p, code, 'utf8');
