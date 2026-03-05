import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// ---------------------------------------------------------------------------
// ADB Airport Area Hierarchy
// ---------------------------------------------------------------------------
// Structure:
//   3 terminals: DOM (Domestic), INT (International), CIP (VIP Lounge)
//   Each terminal has 3 floors: Ground (G), First (1F), Airside (AIR)
//   Each floor has 1-3 zones: Retail (R), Food Court (F), Gate (GT)
//   Each zone has leasable units with realistic area_m2 values
//   Total: 13+ leasable units
// ---------------------------------------------------------------------------

interface UnitSpec {
  code: string;
  name: string;
  areaM2: number;
}

interface ZoneSpec {
  code: string;
  name: string;
  units: UnitSpec[];
}

interface FloorSpec {
  code: string;
  name: string;
  zones: ZoneSpec[];
}

interface TerminalSpec {
  code: string;
  name: string;
  floors: FloorSpec[];
}

const adbHierarchy: TerminalSpec[] = [
  // -------------------------------------------------------------------------
  // DOMESTIC TERMINAL
  // -------------------------------------------------------------------------
  {
    code: 'DOM',
    name: 'Domestic Terminal',
    floors: [
      {
        code: 'DOM-G',
        name: 'Domestic Ground Floor',
        zones: [
          {
            code: 'DOM-G-R',
            name: 'Domestic Ground Retail Zone',
            units: [
              { code: 'DOM-G-R-001', name: 'Duty Free Main', areaM2: 250.0 },
              { code: 'DOM-G-R-002', name: 'Newsagent & Books', areaM2: 45.5 },
            ],
          },
          {
            code: 'DOM-G-F',
            name: 'Domestic Ground Food Court',
            units: [
              { code: 'DOM-G-F-001', name: 'Ground Floor Cafe', areaM2: 78.0 },
            ],
          },
        ],
      },
      {
        code: 'DOM-1F',
        name: 'Domestic First Floor',
        zones: [
          {
            code: 'DOM-1F-R',
            name: 'Domestic First Floor Retail Zone',
            units: [
              { code: 'DOM-1F-R-001', name: 'Luxury Accessories', areaM2: 62.0 },
              { code: 'DOM-1F-R-002', name: 'Electronics Kiosk', areaM2: 38.75 },
            ],
          },
        ],
      },
      {
        code: 'DOM-AIR',
        name: 'Domestic Airside',
        zones: [
          {
            code: 'DOM-AIR-GT',
            name: 'Domestic Airside Gate Zone',
            units: [
              { code: 'DOM-AIR-GT-001', name: 'Gate Lounge Cafe A', areaM2: 55.0 },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // INTERNATIONAL TERMINAL
  // -------------------------------------------------------------------------
  {
    code: 'INT',
    name: 'International Terminal',
    floors: [
      {
        code: 'INT-G',
        name: 'International Ground Floor',
        zones: [
          {
            code: 'INT-G-R',
            name: 'International Ground Retail Zone',
            units: [
              { code: 'INT-G-R-001', name: 'International Duty Free', areaM2: 320.0 },
              { code: 'INT-G-R-002', name: 'Travel Essentials', areaM2: 42.0 },
            ],
          },
          {
            code: 'INT-G-F',
            name: 'International Ground Food Court',
            units: [
              { code: 'INT-G-F-001', name: 'International Food Hall', areaM2: 120.5 },
            ],
          },
        ],
      },
      {
        code: 'INT-1F',
        name: 'International First Floor',
        zones: [
          {
            code: 'INT-1F-R',
            name: 'International First Floor Retail Zone',
            units: [
              { code: 'INT-1F-R-001', name: 'Fashion Boutique', areaM2: 85.0 },
            ],
          },
        ],
      },
      {
        code: 'INT-AIR',
        name: 'International Airside',
        zones: [
          {
            code: 'INT-AIR-GT',
            name: 'International Airside Gate Zone',
            units: [
              { code: 'INT-AIR-GT-001', name: 'Airside Lounge Bar', areaM2: 95.0 },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // CIP (VIP) TERMINAL
  // -------------------------------------------------------------------------
  {
    code: 'CIP',
    name: 'CIP Lounge Terminal',
    floors: [
      {
        code: 'CIP-G',
        name: 'CIP Ground Floor',
        zones: [
          {
            code: 'CIP-G-R',
            name: 'CIP Ground Retail Zone',
            units: [
              { code: 'CIP-G-R-001', name: 'VIP Gift Shop', areaM2: 35.0 },
            ],
          },
        ],
      },
      {
        code: 'CIP-1F',
        name: 'CIP First Floor',
        zones: [
          {
            code: 'CIP-1F-F',
            name: 'CIP First Floor Dining',
            units: [
              { code: 'CIP-1F-F-001', name: 'CIP Executive Dining', areaM2: 68.0 },
            ],
          },
        ],
      },
      {
        code: 'CIP-AIR',
        name: 'CIP Airside',
        zones: [
          {
            code: 'CIP-AIR-GT',
            name: 'CIP Airside Lounge',
            units: [
              { code: 'CIP-AIR-GT-001', name: 'Premium Lounge Retail', areaM2: 28.0 },
            ],
          },
        ],
      },
    ],
  },
];

async function seedAirportHierarchy(airportId: string): Promise<void> {
  for (const terminal of adbHierarchy) {
    // Terminal (depth 1)
    const terminalArea = await prisma.area.upsert({
      where: { airportId_code: { airportId, code: terminal.code } },
      update: {},
      create: {
        airportId,
        code: terminal.code,
        name: terminal.name,
        areaType: 'terminal',
        isLeasable: false,
      },
    });

    for (const floor of terminal.floors) {
      // Floor (depth 2)
      const floorArea = await prisma.area.upsert({
        where: { airportId_code: { airportId, code: floor.code } },
        update: {},
        create: {
          airportId,
          parentAreaId: terminalArea.id,
          code: floor.code,
          name: floor.name,
          areaType: 'floor',
          isLeasable: false,
        },
      });

      for (const zone of floor.zones) {
        // Zone (depth 3)
        const zoneArea = await prisma.area.upsert({
          where: { airportId_code: { airportId, code: zone.code } },
          update: {},
          create: {
            airportId,
            parentAreaId: floorArea.id,
            code: zone.code,
            name: zone.name,
            areaType: 'zone',
            isLeasable: false,
          },
        });

        for (const unit of zone.units) {
          // Unit (depth 4, leasable)
          await prisma.area.upsert({
            where: { airportId_code: { airportId, code: unit.code } },
            update: {},
            create: {
              airportId,
              parentAreaId: zoneArea.id,
              code: unit.code,
              name: unit.name,
              areaType: 'unit',
              areaM2: unit.areaM2,
              isLeasable: true,
            },
          });
        }
      }
    }
  }
}

async function main() {
  console.log('Seeding database...');

  // 1. Airport
  const airport = await prisma.airport.upsert({
    where: { code: 'ADB' },
    update: {},
    create: {
      code: 'ADB',
      name: 'Izmir Adnan Menderes International Airport',
      countryCode: 'TR',
      defaultCurrency: 'TRY',
      timezone: 'Europe/Istanbul',
    },
  });
  console.log(`Airport: ${airport.name} (${airport.code})`);

  // 2. Area hierarchy: 3 terminals, 3 floors each, 1-3 zones per floor, 1-2 units per zone
  await seedAirportHierarchy(airport.id);

  const areaCount = await prisma.area.count();
  const unitCount = await prisma.area.count({ where: { areaType: 'unit' } });
  console.log(`Areas: ${areaCount} total, ${unitCount} leasable units`);

  // 3. Tenants
  const tenants = [
    {
      code: 'TNT-001',
      name: 'Aegean Duty Free',
      email: 'contact@aegeandutyfree.com',
    },
    {
      code: 'TNT-002',
      name: 'Sky Cafe',
      email: 'info@skycafe.com',
    },
    {
      code: 'TNT-003',
      name: 'Airport Parking Ltd',
      email: 'info@airportparking.com',
    },
  ];

  const createdTenants: Record<string, string> = {};

  for (const t of tenants) {
    const tenant = await prisma.tenant.upsert({
      where: {
        airportId_code: { airportId: airport.id, code: t.code },
      },
      update: {},
      create: {
        airportId: airport.id,
        code: t.code,
        name: t.name,
        email: t.email,
        status: 'active',
      },
    });
    createdTenants[t.code] = tenant.id;
  }
  console.log(`Tenants: ${tenants.length} created`);

  // 4. Users (all roles)
  const users = [
    {
      email: 'super@airport.dev',
      password: 'SuperAdmin123!',
      name: 'Super Admin',
      role: 'super_admin' as const,
      airportId: null as string | null,
      tenantId: null as string | null,
    },
    {
      email: 'admin@adb.airport',
      password: 'AdbAdmin123!',
      name: 'ADB Admin',
      role: 'airport_admin' as const,
      airportId: airport.id,
      tenantId: null as string | null,
    },
    {
      email: 'commercial@adb.airport',
      password: 'Commercial123!',
      name: 'Commercial Manager',
      role: 'commercial_manager' as const,
      airportId: airport.id,
      tenantId: null as string | null,
    },
    {
      email: 'finance@adb.airport',
      password: 'Finance123!',
      name: 'Finance Officer',
      role: 'finance' as const,
      airportId: airport.id,
      tenantId: null as string | null,
    },
    {
      email: 'auditor@adb.airport',
      password: 'Auditor123!',
      name: 'Auditor',
      role: 'auditor' as const,
      airportId: airport.id,
      tenantId: null as string | null,
    },
    {
      email: 'tenant.admin@dutyfree.com',
      password: 'TenantAdmin123!',
      name: 'Tenant Admin',
      role: 'tenant_admin' as const,
      airportId: airport.id,
      tenantId: createdTenants['TNT-001'],
    },
    {
      email: 'tenant.user@dutyfree.com',
      password: 'TenantUser123!',
      name: 'Tenant User',
      role: 'tenant_user' as const,
      airportId: airport.id,
      tenantId: createdTenants['TNT-001'],
    },
  ];

  for (const u of users) {
    const passwordHash = await hashPassword(u.password);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        airportId: u.airportId,
        tenantId: u.tenantId,
      },
    });
  }
  console.log(`Users: ${users.length} created`);

  // 5. Billing policy (idempotent — only create if none exist for this airport)
  const existingPolicy = await prisma.billingPolicy.findFirst({
    where: { airportId: airport.id },
  });

  if (!existingPolicy) {
    await prisma.billingPolicy.create({
      data: {
        airportId: airport.id,
        cutOffDay: 10,
        issueDay: 15,
        dueDateDays: 30,
        leadDays: 5,
        fiscalYearStartMonth: 1,
        effectiveFrom: new Date('2026-01-01'),
        status: 'active',
      },
    });
    console.log('Billing policy created');
  } else {
    console.log('Billing policy already exists, skipping');
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
