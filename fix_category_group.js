const fs = require('fs');
let content = fs.readFileSync('src/components/expenses/ExpenseClientTable.tsx', 'utf8');

const oldLogic = `      let type = 'Other';
      if (c.startsWith('4')) type = 'Income';
      else if (c.startsWith('5')) type = 'Cost of Goods Sold';
      else if (c.startsWith('6')) type = 'Operating Expenses';
      else if (c.startsWith('1')) type = 'Assets';
      else if (c.startsWith('2')) type = 'Liabilities';
      else if (c.startsWith('3')) type = 'Equity';
      else if (c.startsWith('7')) type = 'Other Income';
      else if (c.startsWith('8')) type = 'Other Expense';`;

const newLogic = `      let type = 'Operating Expenses'; // Default for unnumbered
      if (c.startsWith('4')) type = 'Income';
      else if (c.startsWith('5') || c.toLowerCase().includes('material')) type = 'Cost of Goods Sold';
      else if (c.startsWith('6') || c.toLowerCase().includes('software')) type = 'Operating Expenses';
      else if (c.startsWith('1')) type = 'Assets';
      else if (c.startsWith('2')) type = 'Liabilities';
      else if (c.startsWith('3')) type = 'Equity';
      else if (c.startsWith('7')) type = 'Other Income';
      else if (c.startsWith('8')) type = 'Other Expense';`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/expenses/ExpenseClientTable.tsx', content);
console.log("Done");
