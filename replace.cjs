const fs = require('fs');
let content = fs.readFileSync('src/components/ComparisonTable.tsx', 'utf8');

content = content.replace(/border-black/g, 'border-[#000000]');
content = content.replace(/text-black/g, 'text-[#000000]');
content = content.replace(/bg-white/g, 'bg-[#ffffff]');
content = content.replace(/border-gray-200/g, 'border-[#e5e7eb]');
content = content.replace(/bg-gray-50/g, 'bg-[#f9fafb]');
content = content.replace(/bg-transparent/g, 'bg-transparent'); // keep or change?
content = content.replace(/bg-gray-100\/50/g, 'bg-[#f3f4f6]');
content = content.replace(/bg-gray-200\/50/g, 'bg-[#e5e7eb]');

fs.writeFileSync('src/components/ComparisonTable.tsx', content);
