const fs = require('fs');
let content = fs.readFileSync('src/components/ComparisonTable.tsx', 'utf8');

// Replace any trailing border-black or bg-transparent that tailwind might map to oklch
content = content.replace(/border-black/g, 'border-[#000000]');
content = content.replace(/bg-transparent/g, 'bg-[#ffffff]'); 

fs.writeFileSync('src/components/ComparisonTable.tsx', content);
