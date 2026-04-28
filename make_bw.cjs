const fs = require('fs');
let content = fs.readFileSync('src/components/ComparisonTable.tsx', 'utf8');

content = content.replace(/#f9fafb/g, '#ffffff');
content = content.replace(/#f3f4f6/g, '#ffffff');
content = content.replace(/#e5e7eb/g, '#ffffff');
content = content.replace(/#6b7280/g, '#000000');
content = content.replace(/#374151/g, '#000000');

fs.writeFileSync('src/components/ComparisonTable.tsx', content);
