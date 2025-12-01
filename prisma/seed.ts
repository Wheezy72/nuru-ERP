import { PrismaClient, UserRole, TaxRate, EmployeeRole } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

faker.locale = 'en';

function randomKenyanPhone() {
  const prefixes = ['0712', '0722', '0733', '0790', '0741'];
  const prefix = faker.helpers.arrayElement(prefixes);
  const suffix = faker.string.numeric(6);
  return `+254${prefix.slice(1)}${suffix}`;
}

function randomKenyanName() {
  const firstNames = ['Wanjiku', 'Kamau', 'Otieno', 'Achieng', 'Mwangi', 'Njeri', 'Mutiso', 'Cherono'];
  const lastNames = ['Mwangi', 'Omondi', 'Atieno', 'Muli', 'Odhiambo', 'Wambui', 'Koech', 'Kiptoo'];
  return `${faker.helpers.arrayElement(firstNames)} ${faker.helpers.arrayElement(lastNames)}`;
}

async function createTenants() {
  const nuru = await prisma.tenant.create({
    data: {
      name: 'Nuru Hardware (SME)',
      code: 'NURU-HW',
      isActive: true,
      locale: 'en-KE',
      currency: 'KES',
    },
  });

  const wamama = await prisma.tenant.create({
    data: {
      name: 'Wamama Pamoja (Chama)',
      code: 'WAMAMA-PAMOJA',
      isActive: true,
      locale: 'en-KE',
      currency: 'KES',
      features: {
        enableChama: true,
      },
    },
  });

  const safari = await prisma.tenant.create({
    data: {
      name: 'Safari Haulage & Plant Hire',
      code: 'SAFARI-FLEET',
      isActive: true,
      locale: 'en-KE',
      currency: 'KES',
      features: {
        enableChama: true,
      },
    },
  });

  const stMarys = await prisma.tenant.create({
    data: {
      name: "St. Mary's Academy",
      code: 'ST-MARYS-ACADEMY',
      isActive: true,
      locale: 'en-KE',
      currency: 'KES',
      features: {
        type: 'SCHOOL',
        enableRecurringBilling: true,
      },
    },
  });

  const greenLeaf = await prisma.tenant.create({
    data: {
      name: 'GreenLeaf Agrovet & Vet',
      code: 'GREENLEAF-AGROVET',
      isActive: true,
      locale: 'en-KE',
      currency: 'KES',
      features: {
        type: 'AGROVET',
      },
    },
  });

  return { nuru, wamama, safari, stMarys, greenLeaf };
}

async function createUsers(tenantId: string) {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.createMany({
    data: [
      {
        tenantId,
        email: `admin+${tenantId}@nuru.app`,
        name: 'Admin',
        role: UserRole.ADMIN,
        passwordHash,
        phone: randomKenyanPhone(),
      },
      {
        tenantId,
        email: `manager+${tenantId}@nuru.app`,
        name: 'Manager',
        role: UserRole.MANAGER,
        passwordHash,
        phone: randomKenyanPhone(),
      },
      {
        tenantId,
        email: `cashier+${tenantId}@nuru.app`,
        name: 'Cashier',
        role: UserRole.CASHIER,
        passwordHash,
        phone: randomKenyanPhone(),
      },
    ],
  });
}

async function seedInventory(tenantId: string) {
  const unitNames = ['Piece', 'Bottle', 'Litre', 'Kilogram', 'Bag', 'Box'];
  const units = await Promise.all(
    unitNames.map((name) =>
      prisma.unitOfMeasure.create({
        data: {
          tenantId,
          name,
          category: 'Unit',
          ratio: 1,
        },
      })
    )
  );

  const piece = units.find((u) => u.name === 'Piece')!;
  const bottle = units.find((u) => u.name === 'Bottle')!;
  const bag = units.find((u) => u.name === 'Bag')!;

  const crate = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Crate',
      category: 'Unit',
      ratio: 24,
      baseUnitId: bottle.id,
    },
  });

  const bale = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Bale',
      category: 'Unit',
      ratio: 10,
      baseUnitId: bag.id,
    },
  });

  const location = await prisma.location.create({
    data: {
      tenantId,
      name: 'Main Shop',
      code: 'MAIN',
      isActive: true,
    },
  });

  const productNames = [
    'Simba Cement 50kg',
    'Rhino Cement 32.5R',
    'DAP Fertilizer 50kg',
    'CAN Fertilizer 50kg',
    'Panga',
    'Hammer',
    'Nails 2 inch Box',
    'Nails 3 inch Box',
    'Wheelbarrow',
    'Paint 20L White',
    'Paint 20L Cream',
    'Thinner 5L',
    'Steel Rod 8mm',
    'Steel Rod 10mm',
    'Roofing Sheet Mabati 2m',
    'Roofing Sheet Mabati 3m',
    'Binding Wire 25kg',
    'Plumbing Pipe 1 inch',
    'Plumbing Pipe 1/2 inch',
    'Tile Adhesive 20kg',
    'Cooking Oil 1L',
    'Cooking Oil 5L',
    'Sugar 2kg',
    'Flour 2kg',
    'Maize Flour 2kg',
    'Rice 5kg',
    'Salt 1kg',
    'Soap Bar 800g',
    'Detergent Powder 1kg',
    'Charcoal Bag',
    'Gas Cylinder 6kg',
    'Gas Cylinder 13kg',
    'Chicken Feed 50kg',
    'Layer Mash 50kg',
    'Kales Seedlings Tray',
    'Tomato Seedlings Tray',
    'Onion Seedlings Tray',
    'Maize Seed 5kg',
    'Beans Seed 5kg',
    'Fencing Post 7ft',
    'Fencing Wire Roll',
    'Water Tank 1000L',
    'Water Tank 5000L',
    'Wheel Spanner',
    'Car Jack',
    'Torch Rechargeable',
    'Extension Cable 10m',
    'Extension Cable 20m',
  ];

  const products = [];

  for (const name of productNames) {
    const defaultUom =
      name.includes('Oil 1L') || name.includes('Oil 5L')
        ? bottle
        : name.includes('Fertilizer') || name.includes('Flour') || name.includes('Feed')
        ? bag
        : piece;

    const product = await prisma.product.create({
      data: {
        tenantId,
        name,
        sku: faker.string.alphanumeric(8).toUpperCase(),
        defaultUomId: defaultUom.id,
        category: name.includes('Fertilizer')
          ? 'Fertilizer'
          : name.includes('Cement')
          ? 'Cement'
          : name.includes('Oil')
          ? 'FMCG'
          : 'General',
        // Set a simple minimum stock threshold to enable meaningful alerts.
        minStockQuantity: faker.number.int({ min: 5, max: 30 }),
      },
    });

    products.push(product);

    const initialQty = faker.number.int({ min: 10, max: 200 });
    await prisma.stockQuant.create({
      data: {
        tenantId,
        productId: product.id,
        locationId: location.id,
        uomId: defaultUom.id,
        quantity: initialQty,
      },
    });
  }

  const specialProducts = await prisma.product.findMany({
    where: { tenantId, name: { in: ['Cooking Oil 1L', 'Cooking Oil 5L'] } },
  });

  for (const sp of specialProducts) {
    await prisma.stockQuant.create({
      data: {
        tenantId,
        productId: sp.id,
        locationId: location.id,
        uomId: crate.id,
        quantity: 5,
      },
    });
  }

  return { products, location, units: { piece, bottle, bag, crate, bale } };
}

async function seedCustomers(tenantId: string) {
  const customers = [];
  for (let i = 0; i < 50; i++) {
    const name = randomKenyanName();
    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name,
        phone: randomKenyanPhone(),
        email: faker.internet.email({ firstName: name.split(' ')[0] }),
        kraPin: `A${faker.string.alphanumeric(9).toUpperCase()}`,
      },
    });
    customers.push(customer);
  }
  return customers;
}

async function randomTaxRate(): Promise<TaxRate> {
  const rates: TaxRate[] = [TaxRate.VAT_16, TaxRate.VAT_8, TaxRate.EXEMPT, TaxRate.ZERO];
  return faker.helpers.arrayElement(rates);
}

async function seedInvoices(tenantId: string, locationId: string, products: any[], customers: any[]) {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(now.getMonth() - 3);

  for (let i = 0; i < 500; i++) {
    const issueDate = faker.date.between({ from: start, to: now });
    const customer = faker.helpers.arrayElement(customers);

    const lineCount = faker.number.int({ min: 1, max: 5 });
    const items: any[] = [];

    let subtotal = 0;

    for (let j = 0; j < lineCount; j++) {
      const product = faker.helpers.arrayElement(products);
      const quantity = faker.number.int({ min: 1, max: 10 });
      const unitPrice = faker.number.int({ min: 100, max: 3000 });

      subtotal += quantity * unitPrice;

      items.push({
        tenantId,
        productId: product.id,
        quantity,
        unitPrice,
        uomId: product.defaultUomId,
        lineTotal: quantity * unitPrice,
        hsCode: faker.string.numeric(6),
        taxRate: await randomTaxRate(),
      });
    }

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        customerId: customer.id,
        invoiceNo: `INV-${faker.string.numeric(6)}`,
        status: faker.helpers.arrayElement(['Posted', 'Paid']),
        issueDate,
        totalAmount: subtotal,
        items: {
          create: items,
        },
      },
    });

    for (const item of items) {
      await prisma.stockQuant.updateMany({
        where: {
          tenantId,
          productId: item.productId,
          locationId,
          uomId: item.uomId,
        },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });

      await prisma.transaction.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: item.lineTotal,
          type: 'Credit',
          reference: `Invoice ${invoice.invoiceNo}`,
        },
      });
    }
  }
}

async function createDefaultAdmin(tenantId: string) {
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.create({
    data: {
      tenantId,
      email: 'admin@nuru.app',
      name: 'Nuru Admin',
      role: UserRole.ADMIN,
      passwordHash,
      phone: randomKenyanPhone(),
    },
  });
}

async function seedFleetTenant(tenantId: string) {
  // Service units
  const day = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Day',
      category: 'Time',
      ratio: 1,
    },
  });

  await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Trip',
      category: 'Service',
      ratio: 1,
    },
  });

  const location = await prisma.location.create({
    data: {
      tenantId,
      name: 'Fleet Yard',
      code: 'FLEET',
      isActive: true,
    },
  });

  const services = [
    {
      name: 'Isuzu FRR (6-Ton) – Lorry Hire',
      defaultUomId: day.id,
      dailyRate: 15000,
      category: 'Fleet',
    },
    {
      name: 'Caterpillar Backhoe – Plant Hire',
      defaultUomId: day.id,
      dailyRate: 35000,
      category: 'Plant',
    },
    {
      name: 'Toyota Fielder (Uber) – Taxi',
      defaultUomId: day.id,
      dailyRate: 2500,
      category: 'Taxi',
    },
  ];

  const products: { product: any; dailyRate: number }[] = [];
  for (const svc of services) {
    const product = await prisma.product.create({
      data: {
        tenantId,
        name: svc.name,
        sku: faker.string.alphanumeric(8).toUpperCase(),
        defaultUomId: svc.defaultUomId,
        category: svc.category,
        minStockQuantity: 0,
      },
    });
    products.push({ product, dailyRate: svc.dailyRate });

    // Treat capacity as effectively "infinite" stock for demo purposes.
    await prisma.stockQuant.create({
      data: {
        tenantId,
        productId: product.id,
        locationId: location.id,
        uomId: svc.defaultUomId,
        quantity: 100000,
      },
    });
  }

  // Fleet employees (casuals) for payroll demo
  await prisma.employee.createMany({
    data: [
      {
        tenantId,
        name: 'Peter Odhiambo (Turnboy)',
        phone: randomKenyanPhone(),
        dailyRate: 800,
        role: EmployeeRole.CASUAL,
      },
      {
        tenantId,
        name: 'Grace Wanjiru (Loader)',
        phone: randomKenyanPhone(),
        dailyRate: 900,
        role: EmployeeRole.CASUAL,
      },
      {
        tenantId,
        name: 'James Kiptoo (Driver)',
        phone: randomKenyanPhone(),
        dailyRate: 1500,
        role: EmployeeRole.PERMANENT,
      },
    ],
  });

  // Fleet customers / drivers
  const mota = await prisma.customer.create({
    data: {
      tenantId,
      name: 'Mota Construction Ltd',
      phone: randomKenyanPhone(),
      email: 'accounts@mota-construction.co.ke',
      kraPin: `P${faker.string.alphanumeric(9).toUpperCase()}`,
    },
  });

  const johnKamau = await prisma.customer.create({
    data: {
      tenantId,
      name: 'John Kamau (Driver)',
      phone: randomKenyanPhone(),
      email: 'john.kamau@example.com',
      kraPin: `A${faker.string.alphanumeric(9).toUpperCase()}`,
    },
  });

  const fleetCustomers = [mota, johnKamau];

  // Generate about 20 hire invoices over the last 60 days
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 60);

  for (let i = 0; i < 20; i++) {
    const issueDate = faker.date.between({ from: start, to: now });
    const { product, dailyRate } = faker.helpers.arrayElement(products);
    const days = faker.number.int({ min: 1, max: 10 });
    const customer = faker.helpers.arrayElement(fleetCustomers);

    const baseAmount = days * dailyRate;

    const item = {
      tenantId,
      productId: product.id,
      quantity: days,
      unitPrice: dailyRate,
      uomId: product.defaultUomId,
      lineTotal: baseAmount,
      hsCode: '998721', // generic service code for demonstration
      taxRate: TaxRate.VAT_16,
    };

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        customerId: customer.id,
        invoiceNo: `FLEET-${faker.string.numeric(5)}`,
        status: faker.helpers.arrayElement(['Posted', 'Paid']),
        issueDate,
        totalAmount: baseAmount,
        items: {
          create: [item],
        },
      },
    });

    // Cash flow via transactions (some mimicking M-Pesa remittances)
    await prisma.transaction.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        amount: baseAmount,
        type: 'Credit',
        reference:
          invoice.status === 'Paid'
            ? `M-Pesa STK for ${invoice.invoiceNo}`
            : `Invoice ${invoice.invoiceNo}`,
        createdAt: issueDate,
      },
    });
  }

  // Link this fleet tenant to a Chama constitution as group-owned
  await seedChama(tenantId);
}

async function seedSchoolTenant(tenantId: string) {
  // School-specific units
  const term = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Term',
      category: 'Time',
      ratio: 1,
    },
  });

  const location = await prisma.location.create({
    data: {
      tenantId,
      name: 'School Office',
      code: 'SCH-OFFICE',
      isActive: true,
    },
  });

  // Fee products
  const feeProducts = await Promise.all([
    prisma.product.create({
      data: {
        tenantId,
        name: 'Term 1 Tuition',
        sku: 'TERM1-FEE',
        defaultUomId: term.id,
        category: 'Fees',
        minStockQuantity: 0,
      },
    }),
    prisma.product.create({
      data: {
        tenantId,
        name: 'Term 2 Tuition',
        sku: 'TERM2-FEE',
        defaultUomId: term.id,
        category: 'Fees',
        minStockQuantity: 0,
      },
    }),
    prisma.product.create({
      data: {
        tenantId,
        name: 'Term 3 Tuition',
        sku: 'TERM3-FEE',
        defaultUomId: term.id,
        category: 'Fees',
        minStockQuantity: 0,
      },
    }),
  ]);

  // Minimal stock rows to satisfy inventory assumptions (fees as services)
  for (const p of feeProducts) {
    await prisma.stockQuant.create({
      data: {
        tenantId,
        productId: p.id,
        locationId: location.id,
        uomId: term.id,
        quantity: 100000,
      },
    });
  }

  // Students as customers
  const classes = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'];
  for (let i = 0; i < 40; i++) {
    const name = randomKenyanName();
    const klass = faker.helpers.arrayElement(classes);
    await prisma.customer.create({
      data: {
        tenantId,
        name: `${name} (${klass})`,
        phone: randomKenyanPhone(),
        email: faker.internet.email({ firstName: name.split(' ')[0] }),
        kraPin: null,
      },
    });
  }
}

async function seedChama(tenantId: string) {
  const members = [];
  for (let i = 0; i < 20; i++) {
    const name = randomKenyanName();
    const member = await prisma.member.create({
      data: {
        tenantId,
        name,
        phone: randomKenyanPhone(),
        email: faker.internet.email({ firstName: name.split(' ')[0] }),
      },
    });
    members.push(member);
  }

  await prisma.chamaConstitution.create({
    data: {
      tenantId,
      interestRate: 0.15,
      lateFineAmount: 200,
      maxLoanRatio: 2.0,
    },
  });

  const accounts = [];
  for (const member of members) {
    for (const type of ['ShareCapital', 'Deposits', 'MerryGoRound'] as const) {
      const account = await prisma.account.create({
        data: {
          tenantId,
          memberId: member.id,
          type,
          balance: 0,
        },
      });
      accounts.push(account);
    }
  }

  const now = new Date();
  const start = new Date(now);
  start.setMonth(now.getMonth() - 6);

  for (const account of accounts) {
    const entryCount = faker.number.int({ min: 5, max: 20 });
    for (let i = 0; i < entryCount; i++) {
      const date = faker.date.between({ from: start, to: now });
      const amount = faker.number.int({ min: 200, max: 5000 });
      await prisma.transaction.create({
        data: {
          tenantId,
          accountId: account.id,
          amount,
          type: 'Credit',
          reference: 'Contribution',
          createdAt: date,
        },
      });
      await prisma.account.update({
        where: { id: account.id },
        data: {
          balance: {
            increment: amount,
          },
          updatedAt: date,
        },
      });
    }
  }

  for (let i = 0; i < 5; i++) {
    const borrower = faker.helpers.arrayElement(members);
    const principal = faker.number.int({ min: 5000, max: 50000 });
    const issuedAt = faker.date.between({ from: start, to: now });
    await prisma.loan.create({
      data: {
        tenantId,
        borrowerId: borrower.id,
        principal,
        interestRate: 0.15,
        issuedAt,
        status: 'Active',
      },
    });
  }
}

async function seedAgrovetTenant(tenantId: string) {
  // Agrovet units
  const piece = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Piece',
      category: 'Unit',
      ratio: 1,
    },
  });
  const kilogram = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Kilogram',
      category: 'Weight',
      ratio: 1,
    },
  });

  const location = await prisma.location.create({
    data: {
      tenantId,
      name: 'Agrovet Shop',
      code: 'AG-SHOP',
      isActive: true,
    },
  });

  // Products with batches and expiries
  const tickGrease = await prisma.product.create({
    data: {
      tenantId,
      name: 'Tick Grease 250g (Exp 2025)',
      sku: 'TICK-GREASE-250',
      defaultUomId: piece.id,
      category: 'Vet',
      minStockQuantity: 5,
    },
  });

  const dapFertilizer = await prisma.product.create({
    data: {
      tenantId,
      name: 'DAP Fertilizer 50kg',
      sku: 'DAP-50KG',
      defaultUomId: kilogram.id,
      category: 'Fertilizer',
      minStockQuantity: 10,
    },
  });

  const cowSalt = await prisma.product.create({
    data: {
      tenantId,
      name: 'Cow Salt 2kg',
      sku: 'COW-SALT-2KG',
      defaultUomId: kilogram.id,
      category: 'Supplement',
      minStockQuantity: 10,
    },
  });

  // Tick grease single batch expiry mid-2025
  const tickBatch = await prisma.productBatch.create({
    data: {
      tenantId,
      productId: tickGrease.id,
      batchNumber: 'TG-2025-01',
      expiryDate: new Date(new Date().getFullYear() + 1, 5, 30),
      uomId: piece.id,
    },
  });

  await prisma.stockQuant.create({
    data: {
      tenantId,
      productId: tickGrease.id,
      locationId: location.id,
      batchId: tickBatch.id,
      uomId: piece.id,
      quantity: 120,
    },
  });

  // DAP fertilizer with two batches to demonstrate FEFO
  const dapBatchEarly = await prisma.productBatch.create({
    data: {
      tenantId,
      productId: dapFertilizer.id,
      batchNumber: 'DAP-2024-01',
      expiryDate: new Date(new Date().getFullYear(), 2, 31),
      uomId: kilogram.id,
    },
  });

  const dapBatchLate = await prisma.productBatch.create({
    data: {
      tenantId,
      productId: dapFertilizer.id,
      batchNumber: 'DAP-2025-01',
      expiryDate: new Date(new Date().getFullYear() + 1, 10, 30),
      uomId: kilogram.id,
    },
  });

  await prisma.stockQuant.createMany({
    data: [
      {
        tenantId,
        productId: dapFertilizer.id,
        locationId: location.id,
        batchId: dapBatchEarly.id,
        uomId: kilogram.id,
        quantity: 500,
      },
      {
        tenantId,
        productId: dapFertilizer.id,
        locationId: location.id,
        batchId: dapBatchLate.id,
        uomId: kilogram.id,
        quantity: 800,
      },
    ],
  });

  // Cow salt with a single batch
  const cowSaltBatch = await prisma.productBatch.create({
    data: {
      tenantId,
      productId: cowSalt.id,
      batchNumber: 'CS-2024-01',
      expiryDate: new Date(new Date().getFullYear(), 11, 31),
      uomId: kilogram.id,
    },
  });

  await prisma.stockQuant.create({
    data: {
      tenantId,
      productId: cowSalt.id,
      locationId: location.id,
      batchId: cowSaltBatch.id,
      uomId: kilogram.id,
      quantity: 300,
    },
  });

  // A few agrovet customers
  await prisma.customer.createMany({
    data: [
      {
        tenantId,
        name: 'Kipkorir Dairy Farm',
        phone: randomKenyanPhone(),
        email: 'accounts@kipkorir-dairy.co.ke',
        kraPin: `P${faker.string.alphanumeric(9).toUpperCase()}`,
      },
      {
        tenantId,
        name: 'Mama Mumbi Agrodealer',
        phone: randomKenyanPhone(),
        email: 'mumbi.agro@example.com',
        kraPin: `A${faker.string.alphanumeric(9).toUpperCase()}`,
      },
    ],
  });
}

async function main() {
  console.log('Seeding database with realistic Kenyan data...');

  await prisma.systemLog.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.stockQuant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.loanGuarantor.deleteMany({});
  await prisma.loan.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.chamaConstitution.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  const { nuru, wamama, safari, stMarys, greenLeaf } = await createTenants();

  await createUsers(nuru.id);
  await createUsers(wamama.id);
  await createUsers(safari.id);
  await createUsers(stMarys.id);
  await createUsers(greenLeaf.id);
  await createDefaultAdmin(nuru.id);

  const { products, location } = await seedInventory(nuru.id);
  const customers = await seedCustomers(nuru.id);
  await seedInvoices(nuru.id, location.id, products, customers);

  await seedChama(wamama.id);
  // Fleet / service business seed
  await seedFleetTenant(safari.id);
  // School tenant seed
  await seedSchoolTenant(stMarys.id);
  // Agrovet tenant seed
  await seedAgrovetTenant(greenLeaf.id);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });