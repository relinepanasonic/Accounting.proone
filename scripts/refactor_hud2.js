const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/components/reconcile/ReconciliationHUD.tsx');
let code = fs.readFileSync(p, 'utf8');

// handleMatchAndClear
code = code.replace(
  /const handleMatchAndClear = \(overrideTargetId\?: string\) => \{[\s\S]*?setSelectedBankId\(null\);\n      \} catch \(err: any\) \{/g,
  \const handleMatchAndClear = (overrideTargetId?: string) => {
    const activeTargetIds = typeof overrideTargetId === 'string' ? [overrideTargetId] : currentTargetRecordIds;
    if (!activeBankLine || activeTargetIds.length === 0) return;
    const targetRecords = recordsList.filter((r) => activeTargetIds.includes(r.id));
    if (targetRecords.length === 0) return;

    startTransition(async () => {
      try {
        const bankAmountAbs = Math.abs(activeBankLine.amount);
        const recordAmountAbs = Math.abs(targetRecords.reduce((sum, r) => sum + r.amount, 0));
        
        let shouldClearDiff = false;
        if (bankAmountAbs !== recordAmountAbs) {
          if (targetRecords.length > 1) {
            alert(\Amount mismatch!\\nBank: \\\nSystem: \\\n\\nYou cannot auto-adjust multiple records. Please manually adjust the system records to match the bank statement.\);
            return;
          }
          const proceed = confirm(\Amount mismatch!\\nBank: \\\nSystem: \\\n\\nDo you want to adjust the system record to match the bank statement and continue?\);
          if (!proceed) return;
          shouldClearDiff = true;
        }

        const uniqueRef = \\\BANK-REF:\:\:\\\\;
        
        for (const targetRecord of targetRecords) {
          await reconcileRecord(targetRecord.id, targetRecord.type, uniqueRef, activeBankId, shouldClearDiff ? activeBankLine.amount : undefined);
        }

        setBankLines(prev => prev.filter(l => l.id !== activeBankLine.id));
        setRecordsList(prev => prev.filter(r => !activeTargetIds.includes(r.id)));
        setSelectedRecordIds([]);
        setSelectedBankId(null);
      } catch (err: any) {\
);

// setSelectedRecordId(null) -> setSelectedRecordIds([])
code = code.replace(/setSelectedRecordId\(null\)/g, 'setSelectedRecordIds([])');

// const isHighlighted = rec.id === currentTargetRecordId;
code = code.replace(/const isHighlighted = rec.id === currentTargetRecordId;/g, 'const isHighlighted = currentTargetRecordIds.includes(rec.id);');

// onClick={() => setSelectedRecordId(rec.id)}
code = code.replace(/onClick=\{.*?setSelectedRecordId\(rec\.id\)\}/g, 'onClick={() => setSelectedRecordIds(prev => prev.includes(rec.id) ? prev.filter(id => id !== rec.id) : [...prev, rec.id])}');

// setSelectedRecordId(rec.id);
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
