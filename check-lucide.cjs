const lucide = require('lucide-react');
const fs = require('fs');

const files = fs.readdirSync('./src/pages', { recursive: true }).filter(f => f.endsWith('.tsx'));
files.push('../components/DashboardLayout.tsx');
files.push('../components/ErrorBoundary.tsx');
files.push('../App.tsx');

let allGood = true;
for (const file of files) {
  try {
    const content = fs.readFileSync('./src/pages/' + file, 'utf-8');
    const match = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
    if (match) {
      const imports = match[1].split(',').map(s => s.trim().split(' as ')[0]).filter(Boolean);
      for (const imp of imports) {
        if (!lucide[imp]) {
          console.log(`ERROR: ${imp} not found in lucide-react (used in ${file})`);
          allGood = false;
        }
      }
    }
  } catch(e) {}
}
if (allGood) console.log("All icons exist!");
