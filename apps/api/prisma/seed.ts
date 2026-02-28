import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
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

  // 2. Area hierarchy: 3 terminals, 2 floors each, 2 zones per floor, 1-2 units per zone
  const terminals = [
    { code: 'DOM', name: 'Domestic Terminal' },
    { code: 'INT', name: 'International Terminal' },
    { code: 'CIP', name: 'CIP Terminal' },
  ];

  for (const terminal of terminals) {
    const terminalArea = await prisma.area.upsert({
      where: {
        airportId_code: { airportId: airport.id, code: terminal.code },
      },
      update: {},
      create: {
        airportId: airport.id,
        code: terminal.code,
        name: terminal.name,
        areaType: 'terminal',
        isLeasable: false,
      },
    });

    const floors = [
      { code: `${terminal.code}-GF`, name: `${terminal.name} Ground Floor` },
      { code: `${terminal.code}-1F`, name: `${terminal.name} First Floor` },
    ];

    for (const floor of floors) {
      const floorArea = await prisma.area.upsert({
        where: {
          airportId_code: { airportId: airport.id, code: floor.code },
        },
        update: {},
        create: {
          airportId: airport.id,
          parentAreaId: terminalArea.id,
          code: floor.code,
          name: floor.name,
          areaType: 'floor',
          isLeasable: false,
        },
      });

      const zones = [
        {
          code: `${floor.code}-A`,
          name: `${floor.name} Zone A`,
          units: [
            {
              code: `${floor.code}-A-001`,
              name: `Unit ${floor.code}-A-001`,
              areaM2: 45.5,
            },
          ],
        },
        {
          code: `${floor.code}-B`,
          name: `${floor.name} Zone B`,
          units: [
            {
              code: `${floor.code}-B-001`,
              name: `Unit ${floor.code}-B-001`,
              areaM2: 62.0,
            },
            ...(terminal.code !== 'CIP'
              ? [
                  {
                    code: `${floor.code}-B-002`,
                    name: `Unit ${floor.code}-B-002`,
                    areaM2: 38.75,
                  },
                ]
              : []),
          ],
        },
      ];

      for (const zone of zones) {
        const zoneArea = await prisma.area.upsert({
          where: {
            airportId_code: { airportId: airport.id, code: zone.code },
          },
          update: {},
          create: {
            airportId: airport.id,
            parentAreaId: floorArea.id,
            code: zone.code,
            name: zone.name,
            areaType: 'zone',
            isLeasable: false,
          },
        });

        for (const unit of zone.units) {
          await prisma.area.upsert({
            where: {
              airportId_code: { airportId: airport.id, code: unit.code },
            },
            update: {},
            create: {
              airportId: airport.id,
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

  const areaCount = await prisma.area.count();
  const unitCount = await prisma.area.count({
    where: { areaType: 'unit' },
  });
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

  // 5. Billing policy
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
