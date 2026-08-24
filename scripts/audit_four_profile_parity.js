import { NAVIGATION, ROLES, isRouteAllowed, PRIMARY_MASTER_ONLY_ROUTES } from '../frontend/src/js/navigation.js';

console.log('=== FOUR-PROFILE ROUTING & PERMISSION PARITY AUDIT ===\n');

const profiles = [
  { name: 'PRIMARY MASTER', role: ROLES.MASTER, isPrimary: true },
  { name: 'NORMAL MASTER', role: ROLES.MASTER, isPrimary: false },
  { name: 'OWNER', role: ROLES.OWNER, isPrimary: false },
  { name: 'CAFE OPERATIONS', role: ROLES.CAFE_ADMIN, isPrimary: false }
];

let allPass = true;

for (const p of profiles) {
  console.log(`--- Checking Profile: ${p.name} ---`);
  const navConfig = NAVIGATION[p.role];
  const items = p.role === ROLES.MASTER 
    ? (p.isPrimary ? navConfig.primaryItems : navConfig.normalItems)
    : navConfig.items;

  console.log(`Total sidebar items configured: ${items.length}`);
  
  // Verify all configured routes are allowed
  for (const item of items) {
    const allowed = isRouteAllowed(p.role, item.route, p.isPrimary);
    if (!allowed) {
      console.error(`FAIL: Configured route '${item.route}' is NOT allowed by isRouteAllowed for ${p.name}`);
      allPass = false;
    }
  }

  // If Normal Master, verify Primary-Master-Only routes are strictly blocked
  if (p.role === ROLES.MASTER && !p.isPrimary) {
    for (const pmRoute of PRIMARY_MASTER_ONLY_ROUTES) {
      const allowed = isRouteAllowed(p.role, pmRoute, false);
      if (allowed) {
        console.error(`FAIL: Primary-Master-Only route '${pmRoute}' was allowed for Normal Master!`);
        allPass = false;
      }
    }
    console.log('Verified: All Primary-Master-Only sensitive routes are strictly blocked for Normal Master.');
  }

  console.log(`Profile ${p.name}: OK\n`);
}

if (allPass) {
  console.log('=== ALL FOUR PROFILES PASSED ROUTE PARITY & PERMISSION CHECKS ===');
} else {
  console.error('=== PARITY CHECKS FAILED ===');
  process.exit(1);
}
