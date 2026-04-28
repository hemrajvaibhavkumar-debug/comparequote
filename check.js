const fs = require('fs');
let content = fs.readFileSync('src/components/ComparisonTable.tsx', 'utf8');

content = content.replace(/bg-\[#ffffff\]/g, '');
content = content.replace(/text-\[#000000\]/g, '');
content = content.replace(/border-\[#000000\]/g, 'border-black'); // wait, I'll keep border-black tailwind?
// Actually if tailwind passes border border-black as oklch, it crashes too.
// Let's remove tailwind classes that might cause colors.
// I will use `style={{ ... }}`? No, there is standard Tailwind v4.

// Wait, the user already got 'Attempting to parse an unsupported color function "oklch"' BEFORE I changed to hex colors.
// Let's check `App.tsx`! There is `bg-slate-50`, `text-slate-800`, `text-slate-600` etc in the tree outside the table!
