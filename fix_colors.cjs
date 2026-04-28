const fs = require('fs');
let content = fs.readFileSync('src/components/ComparisonTable.tsx', 'utf8');

content = content.replace(/bg-gray-50\/50/g, 'bg-[#f9fafb]');
content = content.replace(/bg-gray-100\/50/g, 'bg-[#f3f4f6]');
content = content.replace(/bg-gray-200\/50/g, 'bg-[#e5e7eb]');

content = content.replace(/bg-gray-50/g, 'bg-[#f9fafb]');
content = content.replace(/bg-gray-100/g, 'bg-[#f3f4f6]');
content = content.replace(/bg-gray-200/g, 'bg-[#e5e7eb]');

content = content.replace(/text-gray-500/g, 'text-[#6b7280]');
content = content.replace(/text-gray-700/g, 'text-[#374151]');

content = content.replace(/hover:bg-gray-50/g, 'hover:bg-[#f9fafb]');
content = content.replace(/hover:bg-gray-100/g, 'hover:bg-[#f3f4f6]');

fs.writeFileSync('src/components/ComparisonTable.tsx', content);
