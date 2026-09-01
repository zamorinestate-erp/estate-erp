import fs from 'fs';

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const { from, to } of replacements) {
    if (typeof from === 'string') {
      if (content.includes(from)) {
        content = content.replaceAll(from, to);
        changed = true;
      }
    } else if (from instanceof RegExp) {
      if (from.test(content)) {
        content = content.replace(from, to);
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

// 1. components.js
replaceInFile('frontend/src/js/components.js', [
  { from: '"Rahul K (Operations Lead)"', to: '"Operations Lead"' },
  { from: '"Koramangala Main"', to: '"Main Outlet"' },
  { from: '· Koramangala</span>', to: '· Main Outlet</span>' },
  { from: '☕ ZC-0001 · Koramangala Main', to: '☕ ZC-0001 · Main Outlet' },
  { from: '☕ ZC-0002 · Indiranagar Central', to: '☕ ZC-0002 · Branch Outlet' },
  { from: 'newCafeId === "ZC-0002" ? "Indiranagar Central" : newCafeId === "ZC-0003" ? "Calicut Beach" : "Koramangala Main"', to: 'newCafeId === "ZC-0002" ? "Branch Outlet" : newCafeId === "ZC-0003" ? "Calicut Beach" : "Main Outlet"' },
  { from: 'user.name || "Rahul K"', to: 'user.name || "Duty Operator"' },
  { from: '📍 Koramangala Flagship (ZC-0001)', to: '📍 Main Outlet (ZC-0001)' },
  { from: '📍 Indiranagar Roastery (ZC-0002)', to: '📍 Branch Outlet (ZC-0002)' },
  { from: 'placeholder="e.g. Blue Tokai Coffee"', to: 'placeholder="e.g. Registered Vendor"' }
]);

// 2. attendanceShifts.js
replaceInFile('frontend/src/js/modules/attendance/attendanceShifts.js', [
  { from: '(isCafeAdmin ? "Rahul K" : "Zamorin Lead")', to: '"Duty Lead"' },
  { from: 'isCafeAdmin ? "Rahul K"', to: 'isCafeAdmin ? "Duty Lead"' }
]);

// 3. administration.js
replaceInFile('frontend/src/js/pages/administration.js', [
  { from: 'Dawn Roast — Koramangala', to: 'Main Outlet' },
  { from: 'Indiranagar Central', to: 'Branch Outlet' },
  { from: 'placeholder="e.g. Dawn Roast — Koramangala"', to: 'placeholder="e.g. Main Outlet"' },
  { from: 'placeholder="e.g. Dawn Roast — Bangalore Main"', to: 'placeholder="e.g. Main Outlet"' }
]);

// 4. employeeProfile.js
replaceInFile('frontend/src/js/pages/employeeProfile.js', [
  { from: 'role === "STAFF" ? "Rahul" : (role === "CAFE_ADMIN" ? "Ananya" : "Zamorin User")', to: 'role === "STAFF" ? "Staff Member" : (role === "CAFE_ADMIN" ? "Cafe Admin" : "Zamorin User")' }
]);

// 5. financeAccounts.js
replaceInFile('frontend/src/js/pages/financeAccounts.js', [
  { from: 'placeholder="e.g. Roastery Milk Depot or Coffee Importers"', to: 'placeholder="e.g. Vendor Name"' }
]);

// 6. payrollManagement.js
replaceInFile('frontend/src/js/pages/payrollManagement.js', [
  { from: '["EU-0012", "Rahul Menon", "Head Barista", "25000", "28500"]', to: '["EU-0001", "Staff Member", "Barista", "25000", "28500"]' },
  { from: '["EU-0015", "Priya Nair", "Shift Supervisor", "32000", "36500"]', to: '["EU-0002", "Staff Member", "Supervisor", "32000", "36500"]' },
  { from: '["EU-0012", "Rahul Menon", "342000", "12500", "41040", "13680"]', to: '["EU-0001", "Staff Member", "342000", "12500", "41040", "13680"]' },
  { from: '["2026-08-31T08:00:00Z", "PR-202608-ZC0001", "RUN_CALCULATED", "ravi.kumar", "SUCCESS"]', to: '["2026-08-31T08:00:00Z", "PR-202608-ZC0001", "RUN_CALCULATED", "admin", "SUCCESS"]' }
]);

console.log('Final 25-item cleanup complete!');
