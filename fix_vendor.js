const fs = require('fs');
let content = fs.readFileSync('src/components/expenses/NewExpenseForm.tsx', 'utf8');

// 1. Better parsing of initialDesc
const parsingRegex = /const initialDesc = initialData\?\.description \|\| '';[\s\S]*?const existingVendor = [^\n]*;/;
const newParsing = `const initialDesc = initialData?.description || '';
  let initVendorName = '';
  let initNotes = '';
  if (initialDesc.includes(' | ')) {
    const parts = initialDesc.split(' | ');
    initVendorName = parts[0] || '';
    initNotes = parts.slice(1).join(' | ') || '';
  } else {
    const parts = initialDesc.split(' - ');
    initVendorName = parts[0] || '';
    initNotes = parts.slice(1).join(' - ') || '';
  }
  
  const existingVendor = initVendorName ? vendors.find(v => (v.company_name || v.name) === initVendorName) : null;
  let defaultSearchVendor = initVendorName;
  if (initialData?.client_id) {
     const v = vendors.find(x => x.id === initialData.client_id);
     if (v) defaultSearchVendor = v.company_name || v.name;
  } else if (existingVendor) {
     defaultSearchVendor = existingVendor.company_name || existingVendor.name;
  }`;

content = content.replace(parsingRegex, newParsing);

// 2. Fix VendorID and searchVendor initialization
content = content.replace("const [vendorId, setVendorId] = useState(existingVendor?.id || '');", "const [vendorId, setVendorId] = useState(initialData?.client_id || existingVendor?.id || '');");
content = content.replace("const [searchVendor, setSearchVendor] = useState(existingVendor ? (existingVendor.company_name || existingVendor.name) : '');", "const [searchVendor, setSearchVendor] = useState(defaultSearchVendor);");

// 3. Relax validation
content = content.replace(/if \(!vendorId\) \{\s*setErrorMsg\('Please select a vendor or payee name\.'\);\s*return;\s*\}/, 
`if (!searchVendor.trim()) {
      setErrorMsg('Please enter a vendor or payee name.');
      return;
    }`);

// 4. Update finalVendorName fallback
content = content.replace(/const finalVendorName = selectedVendor \? \(selectedVendor\.company_name \|\| selectedVendor\.name\) : 'Unknown Vendor';/, 
`const finalVendorName = selectedVendor ? (selectedVendor.company_name || selectedVendor.name) : searchVendor.trim();`);


fs.writeFileSync('src/components/expenses/NewExpenseForm.tsx', content);
console.log("Done");
