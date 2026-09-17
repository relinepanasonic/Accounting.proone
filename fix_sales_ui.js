const fs = require('fs');

function replaceInFile(filepath, replacements) {
    let content = fs.readFileSync(filepath, 'utf8');
    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(filepath, content);
}

replaceInFile('src/app/sales/page.tsx', [
    { search: "import { Card } from '@/components/ui/card';", replace: "" },
    { search: "import { formatIndonesianCurrency } from '@/lib/utils/formatters';", replace: "import { formatCurrency } from '@/lib/utils/currency';" },
    { search: /formatIndonesianCurrency/g, replace: "formatCurrency" },
    { search: /<Card/g, replace: "<div" },
    { search: /<\/Card>/g, replace: "</div>" }
]);

replaceInFile('src/components/sales/PipelineKanban.tsx', [
    { search: "import { Card } from '@/components/ui/card';", replace: "" },
    { search: "import { formatIndonesianCurrency } from '@/lib/utils/formatters';", replace: "import { formatCurrency } from '@/lib/utils/currency';" },
    { search: /formatIndonesianCurrency/g, replace: "formatCurrency" },
    { search: /<Card/g, replace: "<div" },
    { search: /<\/Card>/g, replace: "</div>" }
]);

replaceInFile('src/components/sales/NewDealModal.tsx', [
    { search: "import { Button } from '@/components/ui/button';", replace: "" },
    { search: /<Button /g, replace: "<button " },
    { search: /<\/Button>/g, replace: "</button>" }
]);

replaceInFile('src/app/sales/customers/page.tsx', [
    { search: "import { Card } from '@/components/ui/card';", replace: "" },
    { search: "import { formatIndonesianCurrency } from '@/lib/utils/formatters';", replace: "import { formatCurrency } from '@/lib/utils/currency';" },
    { search: /formatIndonesianCurrency/g, replace: "formatCurrency" },
    { search: /<Card /g, replace: "<div " },
    { search: /<\/Card>/g, replace: "</div>" },
    { search: "Settings > Contacts", replace: "Settings &gt; Contacts" }
]);
