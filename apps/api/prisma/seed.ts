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

  // 6. Formulas — 12 covering all 6 formula types (all published)
  // ---------------------------------------------------------------------------
  const formulaDefs = [
    {
      code: 'RENT-FIXED',
      name: 'Fixed Rent',
      formulaType: 'arithmetic' as const,
      expression: 'area_m2 * rate_per_m2',
      variables: {
        area_m2: 'Area in square meters',
        rate_per_m2: 'Monthly rate per m2',
      },
    },
    {
      code: 'RENT-INDEXED',
      name: 'Indexed Rent',
      formulaType: 'escalation' as const,
      expression: 'area_m2 * rate_per_m2 * (1 + index_rate)',
      variables: {
        area_m2: 'Area in m2',
        rate_per_m2: 'Base rate per m2',
        index_rate: 'Annual escalation rate',
      },
    },
    {
      code: 'REVSHARE-FLAT',
      name: 'Revenue Share - Flat',
      formulaType: 'revenue_share' as const,
      expression: 'revenue * rate',
      variables: {
        revenue: 'Monthly gross revenue',
        rate: 'Revenue share percentage (e.g. 0.07 = 7%)',
      },
    },
    {
      code: 'REVSHARE-TIERED',
      name: 'Revenue Share - Tiered Step Band',
      formulaType: 'step_band' as const,
      expression: 'revenue * rate',
      variables: {
        revenue: 'Monthly gross revenue',
        bands: [
          { from: 0, to: 100000, rate: 0.05 },
          { from: 100000, to: 300000, rate: 0.08 },
          { from: 300000, to: 999999999, rate: 0.1 },
        ],
      },
    },
    {
      code: 'REVSHARE-CONDITIONAL',
      name: 'Revenue Share - Conditional Rate',
      formulaType: 'conditional' as const,
      expression: 'revenue > 100000 ? revenue * 0.08 : revenue * 0.05',
      variables: {
        revenue: 'Monthly gross revenue',
      },
    },
    {
      code: 'SERVICE-FIXED',
      name: 'Fixed Service Charge',
      formulaType: 'arithmetic' as const,
      expression: 'monthly_amount',
      variables: {
        monthly_amount: 'Fixed monthly service charge amount',
      },
    },
    {
      code: 'SERVICE-AREA',
      name: 'Area-Based Service Charge',
      formulaType: 'arithmetic' as const,
      expression: 'area_m2 * rate_per_m2_service',
      variables: {
        area_m2: 'Area in m2',
        rate_per_m2_service: 'Service charge rate per m2',
      },
    },
    {
      code: 'UTILITY-ELEC',
      name: 'Electricity Utility',
      formulaType: 'arithmetic' as const,
      expression: 'consumption * unit_rate',
      variables: {
        consumption: 'kWh consumed in period',
        unit_rate: 'Price per kWh',
      },
    },
    {
      code: 'UTILITY-WATER',
      name: 'Water Utility',
      formulaType: 'arithmetic' as const,
      expression: 'consumption * unit_rate',
      variables: {
        consumption: 'm3 consumed in period',
        unit_rate: 'Price per m3',
      },
    },
    {
      code: 'UTILITY-GAS',
      name: 'Gas Utility',
      formulaType: 'arithmetic' as const,
      expression: 'consumption * unit_rate',
      variables: {
        consumption: 'm3 gas consumed in period',
        unit_rate: 'Price per m3',
      },
    },
    {
      code: 'PRORATION',
      name: 'Proration Formula',
      formulaType: 'proration' as const,
      expression: 'monthly_amount * (days_occupied / days_in_period)',
      variables: {
        monthly_amount: 'Full month amount',
        days_occupied: 'Days in partial period',
        days_in_period: 'Total days in period',
      },
    },
    {
      code: 'ESCALATION-CPI',
      name: 'CPI Escalation',
      formulaType: 'escalation' as const,
      expression: 'base_amount * (1 + index_rate)',
      variables: {
        base_amount: 'Previous period amount',
        index_rate: 'CPI adjustment rate',
      },
    },
  ];

  const createdFormulas: Record<string, string> = {};

  for (const f of formulaDefs) {
    // Use upsert by airportId+code unique pair
    const formula = await prisma.formula.upsert({
      where: {
        // Note: no compound unique index on formula — use findFirst + create pattern
        id: (
          await prisma.formula
            .findFirst({ where: { airportId: airport.id, code: f.code } })
            .then((r) => r?.id ?? 'non-existent-placeholder')
        ),
      },
      update: {},
      create: {
        airportId: airport.id,
        code: f.code,
        name: f.name,
        formulaType: f.formulaType,
        expression: f.expression,
        variables: f.variables,
        status: 'published',
        version: 1,
        publishedAt: new Date('2026-01-01'),
      },
    });
    createdFormulas[f.code] = formula.id;
  }

  console.log(`Formulas: ${formulaDefs.length} seeded`);

  // 7. Service Definitions — 8 linked to formulas (all published)
  // ---------------------------------------------------------------------------
  const serviceDefs = [
    {
      code: 'SVC-RENT-FIXED',
      name: 'Fixed Rent Service',
      serviceType: 'rent' as const,
      formulaCode: 'RENT-FIXED',
      defaultBillingFreq: 'monthly' as const,
    },
    {
      code: 'SVC-RENT-INDEXED',
      name: 'Indexed Rent Service',
      serviceType: 'rent' as const,
      formulaCode: 'RENT-INDEXED',
      defaultBillingFreq: 'monthly' as const,
    },
    {
      code: 'SVC-REVSHARE-FLAT',
      name: 'Revenue Share - Flat Service',
      serviceType: 'revenue_share' as const,
      formulaCode: 'REVSHARE-FLAT',
      defaultBillingFreq: 'monthly' as const,
    },
    {
      code: 'SVC-REVSHARE-TIERED',
      name: 'Revenue Share - Tiered Service',
      serviceType: 'revenue_share' as const,
      formulaCode: 'REVSHARE-TIERED',
      defaultBillingFreq: 'monthly' as const,
    },
    {
      code: 'SVC-CAM',
      name: 'Common Area Maintenance',
      serviceType: 'service_charge' as const,
      formulaCode: 'SERVICE-AREA',
      defaultBillingFreq: 'monthly' as const,
    },
    {
      code: 'SVC-ELEC',
      name: 'Electricity Service',
      serviceType: 'utility' as const,
      formulaCode: 'UTILITY-ELEC',
      defaultBillingFreq: 'monthly' as const,
    },
    {
      code: 'SVC-WATER',
      name: 'Water Service',
      serviceType: 'utility' as const,
      formulaCode: 'UTILITY-WATER',
      defaultBillingFreq: 'monthly' as const,
    },
    {
      code: 'SVC-GAS',
      name: 'Gas Service',
      serviceType: 'utility' as const,
      formulaCode: 'UTILITY-GAS',
      defaultBillingFreq: 'quarterly' as const,
    },
  ];

  for (const s of serviceDefs) {
    const formulaId = createdFormulas[s.formulaCode];
    if (!formulaId) {
      console.warn(`Formula ${s.formulaCode} not found, skipping service ${s.code}`);
      continue;
    }

    const existing = await prisma.serviceDefinition.findFirst({
      where: { airportId: airport.id, code: s.code },
    });

    if (!existing) {
      await prisma.serviceDefinition.create({
        data: {
          airportId: airport.id,
          code: s.code,
          name: s.name,
          serviceType: s.serviceType,
          formulaId,
          defaultCurrency: 'TRY',
          defaultBillingFreq: s.defaultBillingFreq,
          status: 'published',
          version: 1,
          effectiveFrom: new Date('2026-01-01'),
          publishedAt: new Date('2026-01-01'),
        },
      });
    }
  }

  console.log(`Service definitions: ${serviceDefs.length} seeded`);

  // 8. Contract seed data — 3 sample contracts with area and service assignments
  // ---------------------------------------------------------------------------

  // Look up area IDs needed for contract assignments
  const dutyfreeMainArea = await prisma.area.findFirst({
    where: { airportId: airport.id, code: 'DOM-G-R-001' },
  });
  const intFoodHallArea = await prisma.area.findFirst({
    where: { airportId: airport.id, code: 'INT-G-F-001' },
  });
  const cipExecutiveDiningArea = await prisma.area.findFirst({
    where: { airportId: airport.id, code: 'CIP-1F-F-001' },
  });
  const groundFloorCafeArea = await prisma.area.findFirst({
    where: { airportId: airport.id, code: 'DOM-G-F-001' },
  });

  // Look up service definition IDs needed for contract assignments
  const svcRentFixed = await prisma.serviceDefinition.findFirst({
    where: { airportId: airport.id, code: 'SVC-RENT-FIXED' },
  });
  const svcRevShare = await prisma.serviceDefinition.findFirst({
    where: { airportId: airport.id, code: 'SVC-REVSHARE-FLAT' },
  });
  const svcCam = await prisma.serviceDefinition.findFirst({
    where: { airportId: airport.id, code: 'SVC-CAM' },
  });
  const svcElec = await prisma.serviceDefinition.findFirst({
    where: { airportId: airport.id, code: 'SVC-ELEC' },
  });

  // CNT-001: Duty Free Main (TNT-001), active contract with 2 areas and 3 services
  const existingCnt001 = await prisma.contract.findFirst({
    where: { airportId: airport.id, contractNumber: 'CNT-001', version: 1 },
  });

  if (!existingCnt001) {
    const cnt001 = await prisma.contract.create({
      data: {
        airportId: airport.id,
        tenantId: createdTenants['TNT-001'],
        contractNumber: 'CNT-001',
        version: 1,
        status: 'active',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-12-31'),
        annualMag: 500000,
        magCurrency: 'TRY',
        billingFrequency: 'monthly',
        signedAt: new Date('2025-12-15'),
        publishedAt: new Date('2025-12-10'),
      },
    });

    // 2 areas: Duty Free Main + International Food Hall
    if (dutyfreeMainArea) {
      await prisma.contractArea.create({
        data: {
          contractId: cnt001.id,
          areaId: dutyfreeMainArea.id,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: new Date('2026-12-31'),
        },
      });
    }
    if (intFoodHallArea) {
      await prisma.contractArea.create({
        data: {
          contractId: cnt001.id,
          areaId: intFoodHallArea.id,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: new Date('2026-12-31'),
        },
      });
    }

    // 3 services: rent, revenue_share, service_charge
    if (svcRentFixed) {
      await prisma.contractService.create({
        data: { contractId: cnt001.id, serviceDefinitionId: svcRentFixed.id },
      });
    }
    if (svcRevShare) {
      await prisma.contractService.create({
        data: { contractId: cnt001.id, serviceDefinitionId: svcRevShare.id },
      });
    }
    if (svcCam) {
      await prisma.contractService.create({
        data: { contractId: cnt001.id, serviceDefinitionId: svcCam.id },
      });
    }
    console.log('CNT-001: Duty Free Main contract created (active, 2 areas, 3 services)');
  } else {
    console.log('CNT-001: already exists, skipping');
  }

  // CNT-002: CIP Lounge (TNT-002), draft contract with 1 area and 2 services
  const existingCnt002 = await prisma.contract.findFirst({
    where: { airportId: airport.id, contractNumber: 'CNT-002', version: 1 },
  });

  if (!existingCnt002) {
    const cnt002 = await prisma.contract.create({
      data: {
        airportId: airport.id,
        tenantId: createdTenants['TNT-002'],
        contractNumber: 'CNT-002',
        version: 1,
        status: 'draft',
        effectiveFrom: new Date('2026-03-01'),
        effectiveTo: new Date('2027-02-28'),
        annualMag: 200000,
        magCurrency: 'TRY',
        billingFrequency: 'monthly',
      },
    });

    // 1 area: CIP Executive Dining
    if (cipExecutiveDiningArea) {
      await prisma.contractArea.create({
        data: {
          contractId: cnt002.id,
          areaId: cipExecutiveDiningArea.id,
          effectiveFrom: new Date('2026-03-01'),
          effectiveTo: new Date('2027-02-28'),
        },
      });
    }

    // 2 services: rent, utility
    if (svcRentFixed) {
      await prisma.contractService.create({
        data: { contractId: cnt002.id, serviceDefinitionId: svcRentFixed.id },
      });
    }
    if (svcElec) {
      await prisma.contractService.create({
        data: { contractId: cnt002.id, serviceDefinitionId: svcElec.id },
      });
    }
    console.log('CNT-002: CIP Lounge contract created (draft, 1 area, 2 services)');
  } else {
    console.log('CNT-002: already exists, skipping');
  }

  // CNT-003: Ground Floor Retail (TNT-003), published contract with 1 area and 1 service (no MAG)
  const existingCnt003 = await prisma.contract.findFirst({
    where: { airportId: airport.id, contractNumber: 'CNT-003', version: 1 },
  });

  if (!existingCnt003) {
    const cnt003 = await prisma.contract.create({
      data: {
        airportId: airport.id,
        tenantId: createdTenants['TNT-003'],
        contractNumber: 'CNT-003',
        version: 1,
        status: 'published',
        effectiveFrom: new Date('2026-06-01'),
        effectiveTo: new Date('2027-05-31'),
        annualMag: null, // no MAG
        billingFrequency: 'monthly',
        signedAt: new Date('2026-02-20'),
        publishedAt: new Date('2026-02-15'),
      },
    });

    // 1 area: Ground Floor Cafe
    if (groundFloorCafeArea) {
      await prisma.contractArea.create({
        data: {
          contractId: cnt003.id,
          areaId: groundFloorCafeArea.id,
          effectiveFrom: new Date('2026-06-01'),
          effectiveTo: new Date('2027-05-31'),
        },
      });
    }

    // 1 service: rent
    if (svcRentFixed) {
      await prisma.contractService.create({
        data: { contractId: cnt003.id, serviceDefinitionId: svcRentFixed.id },
      });
    }
    console.log('CNT-003: Ground Floor Retail contract created (published, 1 area, 1 service, no MAG)');
  } else {
    console.log('CNT-003: already exists, skipping');
  }

  // 9. Phase 4: Demo declarations + meter readings for CNT-001
  // ---------------------------------------------------------------------------
  const cnt001Ref = existingCnt001 ?? await prisma.contract.findFirst({
    where: { airportId: airport.id, contractNumber: 'CNT-001', version: 1 },
  });

  if (cnt001Ref) {
    const existingDecl = await prisma.declaration.findFirst({
      where: { contractId: cnt001Ref.id, declarationType: 'revenue' },
    });

    if (!existingDecl) {
      // Revenue declarations: Jan, Feb, Mar 2026
      const revenueMonths = [
        { start: '2026-01-01', end: '2026-01-31', lines: [
          { category: 'Restaurant', gross: 15000 },
          { category: 'Retail', gross: 12000 },
          { category: 'Lounge', gross: 8000 },
        ]}, // total 35,000 — below monthly MAG (41,667)
        { start: '2026-02-01', end: '2026-02-28', lines: [
          { category: 'Restaurant', gross: 18000 },
          { category: 'Retail', gross: 14000 },
          { category: 'Lounge', gross: 10000 },
        ]}, // total 42,000 — above monthly MAG
        { start: '2026-03-01', end: '2026-03-31', lines: [
          { category: 'Restaurant', gross: 16000 },
          { category: 'Retail', gross: 13000 },
          { category: 'Lounge', gross: 9000 },
        ]}, // total 38,000 — below monthly MAG
      ];

      for (const month of revenueMonths) {
        const decl = await prisma.declaration.create({
          data: {
            airportId: airport.id,
            tenantId: createdTenants['TNT-001'],
            contractId: cnt001Ref.id,
            declarationType: 'revenue',
            periodStart: new Date(month.start),
            periodEnd: new Date(month.end),
            status: 'frozen',
            submittedAt: new Date(month.end),
            frozenAt: new Date(month.end),
            frozenToken: `seed-frozen-${month.start}`,
          },
        });

        for (const line of month.lines) {
          await prisma.declarationLine.create({
            data: {
              declarationId: decl.id,
              category: line.category,
              grossAmount: line.gross,
              deductions: 0,
              amount: line.gross,
            },
          });
        }
      }

      console.log('Phase 4 seed: 3 revenue declarations (Jan-Mar) created for CNT-001');

      // Meter readings: Jan + Feb electricity
      const meterReadings = [
        { start: '2026-01-01', end: '2026-01-31', current: 15000, previous: 12500, consumption: 2500 },
        { start: '2026-02-01', end: '2026-02-28', current: 17800, previous: 15000, consumption: 2800 },
      ];

      for (const meter of meterReadings) {
        const meterDecl = await prisma.declaration.create({
          data: {
            airportId: airport.id,
            tenantId: createdTenants['TNT-001'],
            contractId: cnt001Ref.id,
            declarationType: 'meter_reading',
            periodStart: new Date(meter.start),
            periodEnd: new Date(meter.end),
            status: 'frozen',
            submittedAt: new Date(meter.end),
            frozenAt: new Date(meter.end),
            frozenToken: `seed-meter-${meter.start}`,
          },
        });

        await prisma.declarationLine.create({
          data: {
            declarationId: meterDecl.id,
            category: 'electricity',
            grossAmount: meter.current,
            deductions: 0,
            amount: meter.consumption,
            unitOfMeasure: 'kWh',
            notes: JSON.stringify({
              meterType: 'electricity',
              unit: 'kWh',
              location: 'Duty Free Main — DOM-G-R-001',
              previousReading: meter.previous.toString(),
            }),
          },
        });
      }

      console.log('Phase 4 seed: 2 meter reading declarations (Jan-Feb) created for CNT-001');
    } else {
      console.log('Phase 4 seed: declarations already exist, skipping');
    }
  }

  // 10. Phase 5: Demo BillingRun + Notification records
  // ---------------------------------------------------------------------------
  const existingBillingRun = await prisma.billingRun.findFirst({
    where: { airportId: airport.id, runType: 'manual' },
  });

  if (!existingBillingRun) {
    await prisma.billingRun.create({
      data: {
        airportId: airport.id,
        runType: 'manual',
        periodStart: new Date(2026, 0, 1),  // Jan 2026
        periodEnd: new Date(2026, 0, 31),
        status: 'completed',
        runMode: 'full',
        totalObligations: 5,
        totalAmount: 125000,
        totalInvoices: 3,
        completedAt: new Date(),
        contractSnapshot: { contracts: ['demo snapshot'] },
      },
    });
    console.log('Phase 5 seed: Demo billing run created (completed, Jan 2026)');
  } else {
    console.log('Phase 5 seed: Billing run already exists, skipping');
  }

  // Demo Notification records (3 items showing different types/severities)
  const existingNotif = await prisma.notification.findFirst({
    where: { airportId: airport.id },
  });

  if (!existingNotif) {
    const demoNotifications = [
      {
        airportId: airport.id,
        tenantId: createdTenants['TNT-001'],
        type: 'invoice_created' as const,
        channel: 'both' as const,
        title: 'Fatura Olusturuldu - INV-2026-001',
        body: 'Ocak 2026 donemi icin faturaniz olusturulmustur.',
        isRead: false,
      },
      {
        airportId: airport.id,
        tenantId: createdTenants['TNT-001'],
        type: 'payment_received' as const,
        channel: 'in_app' as const,
        title: 'Odeme Alindi - INV-2026-001',
        body: 'TRY 25,000.00 tutarinda odeme basariyla alindi.',
        isRead: true,
        readAt: new Date(),
      },
      {
        airportId: airport.id,
        type: 'billing_run_completed' as const,
        channel: 'in_app' as const,
        title: 'Faturalama Tamamlandi',
        body: 'Ocak 2026 faturalama calismasi tamamlandi. 3 fatura olusturuldu.',
        isRead: false,
      },
    ];

    for (const notif of demoNotifications) {
      await prisma.notification.create({ data: notif });
    }
    console.log('Phase 5 seed: 3 demo notification records created');
  } else {
    console.log('Phase 5 seed: Notifications already exist, skipping');
  }

  // =========================================================================
  // V2: Enterprise Entity Seed Data
  // =========================================================================

  // 11. TenantGroup — 1 parent group (GRP-001) with TNT-001 + TNT-002
  const existingGroup = await prisma.tenantGroup.findFirst({
    where: { airportId: airport.id, code: 'GRP-001' },
  });

  let tenantGroupId: string;
  if (!existingGroup) {
    const group = await prisma.tenantGroup.create({
      data: {
        airportId: airport.id,
        code: 'GRP-001',
        name: 'Retail Holdings Group',
        taxId: 'TR-9876543210',
        contactEmail: 'group@retailholdings.com',
        isActive: true,
      },
    });
    tenantGroupId = group.id;

    // Link TNT-001 and TNT-002 to the group
    await prisma.tenant.update({
      where: { id: createdTenants['TNT-001'] },
      data: { tenantGroupId: group.id },
    });
    await prisma.tenant.update({
      where: { id: createdTenants['TNT-002'] },
      data: { tenantGroupId: group.id },
    });
    console.log('V2 seed: TenantGroup GRP-001 created, TNT-001 + TNT-002 linked');
  } else {
    tenantGroupId = existingGroup.id;
    console.log('V2 seed: TenantGroup already exists, skipping');
  }

  // 12. Equipment — 5 items (2 POS, 1 utility meter, 1 digital signage, 1 kiosk)
  const existingEquipment = await prisma.equipment.findFirst({
    where: { airportId: airport.id, code: 'EQP-001' },
  });

  const equipmentIds: Record<string, string> = {};
  if (!existingEquipment) {
    const equipmentDefs = [
      {
        code: 'EQP-001',
        name: 'POS Terminal A1',
        equipmentType: 'pos_terminal' as const,
        category: 'it_infrastructure' as const,
        manufacturer: 'Ingenico',
        modelName: 'Move 5000',
        serialNumber: 'ING-5000-001',
        status: 'commissioned' as const,
        ownership: 'airport' as const,
        monthlyRentalRate: 850,
        isMetered: false,
        commissionedAt: new Date('2025-06-01'),
      },
      {
        code: 'EQP-002',
        name: 'POS Terminal A2',
        equipmentType: 'pos_terminal' as const,
        category: 'it_infrastructure' as const,
        manufacturer: 'Ingenico',
        modelName: 'Move 5000',
        serialNumber: 'ING-5000-002',
        status: 'commissioned' as const,
        ownership: 'airport' as const,
        monthlyRentalRate: 850,
        isMetered: false,
        commissionedAt: new Date('2025-06-01'),
      },
      {
        code: 'EQP-003',
        name: 'Electricity Meter - Duty Free Main',
        equipmentType: 'utility_meter' as const,
        category: 'utility_infrastructure' as const,
        manufacturer: 'Schneider Electric',
        modelName: 'PM5560',
        serialNumber: 'SE-PM5560-001',
        status: 'commissioned' as const,
        ownership: 'airport' as const,
        isMetered: true,
        meterUnit: 'kWh',
        lastMeterReading: 17800,
        commissionedAt: new Date('2025-01-15'),
        maintenanceIntervalDays: 180,
        nextMaintenanceAt: new Date('2026-07-15'),
      },
      {
        code: 'EQP-004',
        name: 'Digital Signage - Gate A1',
        equipmentType: 'digital_signage' as const,
        category: 'signage' as const,
        manufacturer: 'Samsung',
        modelName: 'QB75B',
        serialNumber: 'SAM-QB75B-001',
        status: 'commissioned' as const,
        ownership: 'airport' as const,
        monthlyRentalRate: 1200,
        isMetered: false,
        commissionedAt: new Date('2025-09-01'),
      },
      {
        code: 'EQP-005',
        name: 'Self-Service Kiosk B1',
        equipmentType: 'kiosk' as const,
        category: 'commercial_fixture' as const,
        manufacturer: 'Elo Touch',
        modelName: 'EloView 22I',
        serialNumber: 'ELO-22I-001',
        status: 'registered' as const,
        ownership: 'airport' as const,
        monthlyRentalRate: 650,
        isMetered: false,
      },
    ];

    for (const eq of equipmentDefs) {
      const areaForEquipment = eq.code === 'EQP-003' ? dutyfreeMainArea : null;
      const eqRecord = await prisma.equipment.create({
        data: {
          airportId: airport.id,
          areaId: areaForEquipment?.id ?? null,
          code: eq.code,
          name: eq.name,
          equipmentType: eq.equipmentType,
          category: eq.category,
          manufacturer: eq.manufacturer,
          modelName: eq.modelName,
          serialNumber: eq.serialNumber,
          status: eq.status,
          ownership: eq.ownership,
          monthlyRentalRate: eq.monthlyRentalRate ?? null,
          isMetered: eq.isMetered,
          meterUnit: eq.isMetered ? eq.meterUnit : null,
          lastMeterReading: (eq as any).lastMeterReading ?? null,
          commissionedAt: (eq as any).commissionedAt ?? null,
          maintenanceIntervalDays: (eq as any).maintenanceIntervalDays ?? null,
          nextMaintenanceAt: (eq as any).nextMaintenanceAt ?? null,
        },
      });
      equipmentIds[eq.code] = eqRecord.id;
    }
    console.log(`V2 seed: ${equipmentDefs.length} equipment records created`);
  } else {
    console.log('V2 seed: Equipment already exists, skipping');
  }

  // 13. EquipmentMeterReading — 2 readings for utility meter (EQP-003)
  if (equipmentIds['EQP-003']) {
    const existingReading = await prisma.equipmentMeterReading.findFirst({
      where: { equipmentId: equipmentIds['EQP-003'] },
    });

    if (!existingReading) {
      await prisma.equipmentMeterReading.create({
        data: {
          equipmentId: equipmentIds['EQP-003'],
          readingDate: new Date('2026-01-31'),
          readingValue: 15000,
          previousValue: 12500,
          consumption: 2500,
          unit: 'kWh',
          readingType: 'periodic',
          source: 'manual',
          isValidated: true,
          validatedBy: 'seed-admin',
          validatedAt: new Date('2026-02-02'),
        },
      });
      await prisma.equipmentMeterReading.create({
        data: {
          equipmentId: equipmentIds['EQP-003'],
          readingDate: new Date('2026-02-28'),
          readingValue: 17800,
          previousValue: 15000,
          consumption: 2800,
          unit: 'kWh',
          readingType: 'periodic',
          source: 'manual',
          isValidated: true,
          validatedBy: 'seed-admin',
          validatedAt: new Date('2026-03-02'),
        },
      });
      console.log('V2 seed: 2 meter readings created for EQP-003');
    }
  }

  // 14. EquipmentMaintenanceLog — 1 maintenance record for EQP-003
  if (equipmentIds['EQP-003']) {
    const existingLog = await prisma.equipmentMaintenanceLog.findFirst({
      where: { equipmentId: equipmentIds['EQP-003'] },
    });

    if (!existingLog) {
      await prisma.equipmentMaintenanceLog.create({
        data: {
          equipmentId: equipmentIds['EQP-003'],
          maintenanceType: 'calibration',
          description: 'Annual calibration of utility meter',
          performedBy: 'Schneider Electric Field Service',
          performedAt: new Date('2026-01-15'),
          cost: 2500,
          currency: 'TRY',
          nextScheduledAt: new Date('2027-01-15'),
        },
      });
      console.log('V2 seed: 1 maintenance log created for EQP-003');
    }
  }

  // 15. ContractEquipment — 2 POS terminals assigned to CNT-001
  if (cnt001Ref && equipmentIds['EQP-001'] && equipmentIds['EQP-002']) {
    const existingCE = await prisma.contractEquipment.findFirst({
      where: { contractId: cnt001Ref.id },
    });

    if (!existingCE) {
      await prisma.contractEquipment.create({
        data: {
          contractId: cnt001Ref.id,
          equipmentId: equipmentIds['EQP-001'],
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: new Date('2026-12-31'),
          monthlyRate: 850,
          rateCurrency: 'TRY',
          isActive: true,
        },
      });
      await prisma.contractEquipment.create({
        data: {
          contractId: cnt001Ref.id,
          equipmentId: equipmentIds['EQP-002'],
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: new Date('2026-12-31'),
          monthlyRate: 850,
          rateCurrency: 'TRY',
          isActive: true,
        },
      });
      console.log('V2 seed: 2 POS terminals assigned to CNT-001');
    }
  }

  // 16. AreaOccupancy — 3 occupancy records
  if (dutyfreeMainArea && intFoodHallArea && cipExecutiveDiningArea) {
    const existingOcc = await prisma.areaOccupancy.findFirst({
      where: { areaId: dutyfreeMainArea.id },
    });

    if (!existingOcc) {
      await prisma.areaOccupancy.create({
        data: {
          areaId: dutyfreeMainArea.id,
          tenantId: createdTenants['TNT-001'],
          contractId: cnt001Ref?.id,
          occupancyType: 'exclusive',
          status: 'occupied',
          occupiedFrom: new Date('2026-01-01'),
          occupiedTo: new Date('2026-12-31'),
          occupiedM2: 250.0,
        },
      });
      await prisma.areaOccupancy.create({
        data: {
          areaId: intFoodHallArea.id,
          tenantId: createdTenants['TNT-001'],
          contractId: cnt001Ref?.id,
          occupancyType: 'shared',
          status: 'occupied',
          occupiedFrom: new Date('2026-01-01'),
          occupiedTo: new Date('2026-12-31'),
          occupiedM2: 60.0,
        },
      });
      await prisma.areaOccupancy.create({
        data: {
          areaId: cipExecutiveDiningArea.id,
          tenantId: createdTenants['TNT-002'],
          occupancyType: 'exclusive',
          status: 'planned',
          occupiedFrom: new Date('2026-03-01'),
          occupiedTo: new Date('2027-02-28'),
          occupiedM2: 68.0,
        },
      });
      console.log('V2 seed: 3 area occupancy records created');
    }
  }

  // 17. AreaAllocation — 1 allocation (active, 60/40 split) for INT Food Hall
  if (intFoodHallArea) {
    const existingAlloc = await prisma.areaAllocation.findFirst({
      where: { areaId: intFoodHallArea.id },
    });

    if (!existingAlloc) {
      const alloc = await prisma.areaAllocation.create({
        data: {
          airportId: airport.id,
          areaId: intFoodHallArea.id,
          allocationMethod: 'proportional_m2',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-12-31'),
          totalCost: 50000,
          currency: 'TRY',
          status: 'active_alloc',
          approvedBy: 'seed-admin',
          approvedAt: new Date('2025-12-20'),
          version: 1,
        },
      });

      // 60/40 split between TNT-001 and TNT-002
      await prisma.areaAllocationShare.create({
        data: {
          allocationId: alloc.id,
          tenantId: createdTenants['TNT-001'],
          contractId: cnt001Ref?.id,
          shareRatio: 0.60,
          calculatedAmount: 30000,
        },
      });
      await prisma.areaAllocationShare.create({
        data: {
          allocationId: alloc.id,
          tenantId: createdTenants['TNT-002'],
          shareRatio: 0.40,
          calculatedAmount: 20000,
        },
      });
      console.log('V2 seed: 1 area allocation (active, 60/40 split) created');
    }
  }

  // 18. TenantScore — 4 scores (TNT-001: Jan/Feb/Mar, TNT-002: Jan)
  const existingScore = await prisma.tenantScore.findFirst({
    where: { tenantId: createdTenants['TNT-001'] },
  });

  if (!existingScore) {
    const scoreDefs = [
      { tenantId: createdTenants['TNT-001'], period: '2026-01-01', payment: 90, declaration: 100, compliance: 100, revenue: 85, overall: 93, risk: 'low' as const, latePayments: 1, missedDecl: 0 },
      { tenantId: createdTenants['TNT-001'], period: '2026-02-01', payment: 80, declaration: 100, compliance: 100, revenue: 100, overall: 93, risk: 'low' as const, latePayments: 2, missedDecl: 0 },
      { tenantId: createdTenants['TNT-001'], period: '2026-03-01', payment: 80, declaration: 85, compliance: 100, revenue: 90, overall: 88, risk: 'low' as const, latePayments: 2, missedDecl: 1 },
      { tenantId: createdTenants['TNT-002'], period: '2026-01-01', payment: 60, declaration: 70, compliance: 50, revenue: 45, overall: 57, risk: 'high' as const, latePayments: 4, missedDecl: 2 },
    ];

    for (const s of scoreDefs) {
      await prisma.tenantScore.create({
        data: {
          tenantId: s.tenantId,
          scorePeriod: new Date(s.period),
          paymentScore: s.payment,
          declarationScore: s.declaration,
          complianceScore: s.compliance,
          revenuePerformance: s.revenue,
          overallScore: s.overall,
          riskCategory: s.risk,
          latePaymentCount: s.latePayments,
          missedDeclarationCount: s.missedDecl,
        },
      });
    }
    console.log('V2 seed: 4 tenant scores created (TNT-001: 3, TNT-002: 1)');
  }

  // 19. CreditNote — 2 credit notes (1 draft, 1 issued)
  if (cnt001Ref) {
    const existingCN = await prisma.creditNote.findFirst({
      where: { airportId: airport.id },
    });

    if (!existingCN) {
      await prisma.creditNote.create({
        data: {
          airportId: airport.id,
          tenantId: createdTenants['TNT-001'],
          contractId: cnt001Ref.id,
          creditNoteNumber: 'CN-001',
          reason: 'billing_error',
          status: 'draft',
          amount: 2500,
          currency: 'TRY',
          description: 'Overcharged service charge for January 2026 — incorrect area m2 used',
        },
      });
      await prisma.creditNote.create({
        data: {
          airportId: airport.id,
          tenantId: createdTenants['TNT-001'],
          contractId: cnt001Ref.id,
          creditNoteNumber: 'CN-002',
          reason: 'equipment_downtime',
          status: 'issued',
          amount: 850,
          currency: 'TRY',
          description: 'POS Terminal EQP-001 downtime: 3 days in February',
          approvedBy: 'seed-admin',
          approvedAt: new Date('2026-02-20'),
          issuedAt: new Date('2026-02-22'),
        },
      });
      console.log('V2 seed: 2 credit notes created (1 draft, 1 issued)');
    }
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
