import { PrismaClient, UserRole, TaxRate, EmployeeRole } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { AccountingService } from '../src/modules/accounting/core/AccountingService';

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

  const nairobiFurniture = await prisma.tenant.create({
    data: {
      name: 'Nairobi Furniture Works',
      code: 'NAIROBI-FURNITURE',
      isActive: true,
      locale: 'en-KE',
      currency: 'KES',
      features: {
        type: 'MANUFACTURING',
      },
    },
  });

  const cityBuilders = await prisma.tenant.create({
    data: {
      name: 'City Builders Ltd',
      code: 'CITY-BUILDERS',
      isActive: true,
      locale: 'en-KE',
      currency: 'KES',
      features: {
        type: 'CONSTRUCTION',
        enableProjects: true,
      },
    },
  });

  return {
    nuru,
    wamama,
    safari,
    stMarys,
    greenLeaf,
    nairobiFurniture,
    cityBuilders,
  };
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

    const defaultPrice = faker.number.int({ min: 100, max: 3000 });

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
        defaultPrice,
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

async function seedInvoices(
  tenantId: string,
  locationId: string,
  products: any[],
  customers: any[],
  invoiceCount = 2500,
) {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(now.getMonth() - 12);

  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  // Force at least one clear dead-stock candidate for dashboard insights.
  const deadStockProduct = products[0];

  for (let i = 0; i < invoiceCount; i++) {
    const issueDate = faker.date.between({ from: start, to: now });
    const customer = faker.helpers.arrayElement(customers);

    const dayOfWeek = issueDate.getDay(); // 0-6
    const dayOfMonth = issueDate.getDate();

    let minLines = 1;
    let maxLines = 3;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      maxLines += 2;
    }
    if (dayOfMonth >= 28) {
      maxLines += 3;
    }

    const lineCount = faker.number.int({ min: minLines, max: maxLines });
    const items: any[] = [];

    let subtotal = 0;

    for (let j = 0; j < lineCount; j++) {
      let product = faker.helpers.arrayElement(products);

      // Avoid selling the dead-stock product in the last 90 days
      if (issueDate >= ninetyDaysAgo && product.id === deadStockProduct.id) {
        product = faker.helpers.arrayElement(
          products.filter((p) => p.id !== deadStockProduct.id),
        );
      }

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

    const paymentRoll = Math.random();
    let status: 'Paid' | 'Partial' | 'Posted';
    let paidAmount = 0;

    if (paymentRoll < 0.7) {
      status = 'Paid';
      paidAmount = subtotal;
    } else if (paymentRoll < 0.85) {
      status = 'Partial';
      const fraction = faker.number.int({ min: 10, max: 80 }) / 100;
      paidAmount = Math.round(subtotal * fraction);
    } else {
      status = 'Posted';
      paidAmount = 0;
    }

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        customerId: customer.id,
        invoiceNo: `INV-${faker.string.numeric(6)}`,
        status,
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
    }

    if (paidAmount > 0) {
      await prisma.transaction.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: paidAmount,
          type: 'Credit',
          reference:
            status === 'Paid'
              ? `Cash payment for ${invoice.invoiceNo}`
              : `Partial payment for ${invoice.invoiceNo}`,
          createdAt: issueDate,
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
        defaultPrice: svc.dailyRate,
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

  // Generate hire invoices over the last 12 months with mixed payment statuses
  const now = new Date();
  const start = new Date(now);
  start.setMonth(now.getMonth() - 12);

  const invoiceCount = 400;

  for (let i = 0; i < invoiceCount; i++) {
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

    const paymentRoll = Math.random();
    let status: 'Paid' | 'Partial' | 'Posted';
    let paidAmount = 0;

    if (paymentRoll < 0.7) {
      status = 'Paid';
      paidAmount = baseAmount;
    } else if (paymentRoll < 0.85) {
      status = 'Partial';
      const fraction = faker.number.int({ min: 10, max: 80 }) / 100;
      paidAmount = Math.round(baseAmount * fraction);
    } else {
      status = 'Posted';
      paidAmount = 0;
    }

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        customerId: customer.id,
        invoiceNo: `FLEET-${faker.string.numeric(5)}`,
        status,
        issueDate,
        totalAmount: baseAmount,
        items: {
          create: [item],
        },
      },
    });

    if (paidAmount > 0) {
      await prisma.transaction.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: paidAmount,
          type: 'Credit',
          reference:
            status === 'Paid'
              ? `M-Pesa STK for ${invoice.invoiceNo}`
              : `Partial hire payment for ${invoice.invoiceNo}`,
          createdAt: issueDate,
        },
      });
    }
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
        defaultPrice: 15000,
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
        defaultPrice: 16000,
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
        defaultPrice: 16000,
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
  const students: any[] = [];
  const studentCount = 350;

  for (let i = 0; i < studentCount; i++) {
    const name = randomKenyanName();
    const klass = faker.helpers.arrayElement(classes);
    const student = await prisma.customer.create({
      data: {
        tenantId,
        name: `${name} (${klass})`,
        phone: randomKenyanPhone(),
        email: faker.internet.email({ firstName: name.split(' ')[0] }),
        kraPin: null,
      },
    });
    students.push(student);
  }

  // Generate term fee invoices for the last academic year
  const now = new Date();
  const year = now.getFullYear();
  const termDates = [
    new Date(year, 0, 10),
    new Date(year, 4, 10),
    new Date(year, 8, 10),
  ];
  const termFees = [15000, 16000, 16000];

  for (const student of students) {
    for (let t = 0; t < feeProducts.length; t++) {
      const baseDate = termDates[t];
      const issueDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate() + faker.number.int({ min: 0, max: 14 }),
      );

      const product = feeProducts[t];
      const amount = termFees[t];

      const paymentRoll = Math.random();
      let status: 'Paid' | 'Partial' | 'Posted';
      let paidAmount = 0;

      if (paymentRoll < 0.7) {
        status = 'Paid';
        paidAmount = amount;
      } else if (paymentRoll < 0.85) {
        status = 'Partial';
        const fraction = faker.number.int({ min: 10, max: 80 }) / 100;
        paidAmount = Math.round(amount * fraction);
      } else {
        status = 'Posted';
        paidAmount = 0;
      }

      const invoice = await prisma.invoice.create({
        data: {
          tenantId,
          customerId: student.id,
          invoiceNo: `SCH-${faker.string.numeric(6)}`,
          status,
          issueDate,
          totalAmount: amount,
          items: {
            create: [
              {
                tenantId,
                productId: product.id,
                quantity: 1,
                unitPrice: amount,
                uomId: term.id,
                lineTotal: amount,
                hsCode: '999999',
                taxRate: TaxRate.EXEMPT,
              },
            ],
          },
        },
      });

      if (paidAmount > 0) {
        await prisma.transaction.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            amount: paidAmount,
            type: 'Credit',
            reference:
              status === 'Paid'
                ? `Fee payment for ${invoice.invoiceNo}`
                : `Partial fee payment for ${invoice.invoiceNo}`,
            createdAt: issueDate,
          },
        });
      }
    }
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
      defaultPrice: 250,
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
      defaultPrice: 80,
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
      defaultPrice: 60,
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

  // Agrovet customers
  const customers: any[] = [];

  const kipkorir = await prisma.customer.create({
    data: {
      tenantId,
      name: 'Kipkorir Dairy Farm',
      phone: randomKenyanPhone(),
      email: 'accounts@kipkorir-dairy.co.ke',
      kraPin: `P${faker.string.alphanumeric(9).toUpperCase()}`,
    },
  });

  const mamaMumbi = await prisma.customer.create({
    data: {
      tenantId,
      name: 'Mama Mumbi Agrodealer',
      phone: randomKenyanPhone(),
      email: 'mumbi.agro@example.com',
      kraPin: `A${faker.string.alphanumeric(9).toUpperCase()}`,
    },
  });

  customers.push(kipkorir, mamaMumbi);

  // Generate agrovet sales invoices over the last 12 months
  const now = new Date();
  const start = new Date(now);
  start.setMonth(now.getMonth() - 12);

  const productsForSale = [tickGrease, dapFertilizer, cowSalt];
  const priceByProductId: Record<string, number> = {
    [tickGrease.id]: 250,
    [dapFertilizer.id]: 80,
    [cowSalt.id]: 60,
  };

  const invoiceCount = 400;

  for (let i = 0; i < invoiceCount; i++) {
    const issueDate = faker.date.between({ from: start, to: now });
    const customer = faker.helpers.arrayElement(customers);

    const dayOfWeek = issueDate.getDay();
    const dayOfMonth = issueDate.getDate();

    let minLines = 1;
    let maxLines = 2;

    if (dayOfWeek === 6 || dayOfWeek === 0) {
      maxLines += 1;
    }
    if (dayOfMonth >= 28) {
      maxLines += 1;
    }

    const lineCount = faker.number.int({ min: minLines, max: maxLines });
    const items: any[] = [];

    let subtotal = 0;

    for (let j = 0; j < lineCount; j++) {
      const product = faker.helpers.arrayElement(productsForSale);
      const baseQtyMin = product.id === dapFertilizer.id ? 10 : 1;
      const baseQtyMax = product.id === dapFertilizer.id ? 50 : 10;
      const quantity = faker.number.int({ min: baseQtyMin, max: baseQtyMax });
      const unitPrice = priceByProductId[product.id];

      subtotal += quantity * unitPrice;

      items.push({
        tenantId,
        productId: product.id,
        quantity,
        unitPrice,
        uomId: product.defaultUomId,
        lineTotal: quantity * unitPrice,
        hsCode: faker.string.numeric(6),
        taxRate: TaxRate.VAT_16,
      });
    }

    const paymentRoll = Math.random();
    let status: 'Paid' | 'Partial' | 'Posted';
    let paidAmount = 0;

    if (paymentRoll < 0.7) {
      status = 'Paid';
      paidAmount = subtotal;
    } else if (paymentRoll < 0.85) {
      status = 'Partial';
      const fraction = faker.number.int({ min: 10, max: 80 }) / 100;
      paidAmount = Math.round(subtotal * fraction);
    } else {
      status = 'Posted';
      paidAmount = 0;
    }

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        customerId: customer.id,
        invoiceNo: `AG-${faker.string.numeric(6)}`,
        status,
        issueDate,
        totalAmount: subtotal,
        items: {
          create: items,
        },
      },
    });

    if (paidAmount > 0) {
      await prisma.transaction.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: paidAmount,
          type: 'Credit',
          reference:
            status === 'Paid'
              ? `Agrovet cash sale ${invoice.invoiceNo}`
              : `Agrovet partial payment ${invoice.invoiceNo}`,
          createdAt: issueDate,
        },
      });
    }
  }
}

async function seedManufacturingTenant(tenantId: string) {
  // Manufacturing units
  const piece = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Piece',
      category: 'Unit',
      ratio: 1,
    },
  });
  const set = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Set',
      category: 'Unit',
      ratio: 1,
    },
  });

  const location = await prisma.location.create({
    data: {
      tenantId,
      name: 'Workshop & Showroom',
      code: 'WORKSHOP',
      isActive: true,
    },
  });

  // Components and finished goods
  const leg = await prisma.product.create({
    data: {
      tenantId,
      name: 'Mahogany Table Leg',
      sku: 'LEG-MAHOGANY',
      defaultUomId: piece.id,
      category: 'Component',
      defaultPrice: 800,
      minStockQuantity: 50,
    },
  });

  const top = await prisma.product.create({
    data: {
      tenantId,
      name: 'Mahogany Table Top',
      sku: 'TOP-MAHOGANY',
      defaultUomId: piece.id,
      category: 'Component',
      defaultPrice: 3500,
      minStockQuantity: 20,
    },
  });

  const table = await prisma.product.create({
    data: {
      tenantId,
      name: 'Mahogany Dining Table (4-Seater)',
      sku: 'TABLE-MAHOGANY-4S',
      defaultUomId: set.id,
      category: 'FinishedGood',
      defaultPrice: 45000,
      minStockQuantity: 10,
    },
  });

  // Seed generous stock so manufacturing and sales never hit negative in the demo
  await prisma.stockQuant.createMany({
    data: [
      {
        tenantId,
        productId: leg.id,
        locationId: location.id,
        batchId: null,
        uomId: piece.id,
        quantity: 2000,
      },
      {
        tenantId,
        productId: top.id,
        locationId: location.id,
        batchId: null,
        uomId: piece.id,
        quantity: 500,
      },
      {
        tenantId,
        productId: table.id,
        locationId: location.id,
        batchId: null,
        uomId: set.id,
        quantity: 300,
      },
    ],
  });

  // Supplier and purchase orders for raw materials
  const supplier = await prisma.supplier.create({
    data: {
      tenantId,
      name: 'Timber & Boards Suppliers Ltd',
      phone: randomKenyanPhone(),
      email: 'orders@timber-boards.co.ke',
      kraPin: `P${faker.string.alphanumeric(9).toUpperCase()}`,
    },
  });

  const accounting = new AccountingService(tenantId);
  const now = new Date();
  const start = new Date(now);
  start.setMonth(now.getMonth() - 12);

  const poCount = 24;

  for (let i = 0; i < poCount; i++) {
    const orderDate = faker.date.between({ from: start, to: now });
    const legQty = faker.number.int({ min: 50, max: 150 });
    const topQty = faker.number.int({ min: 20, max: 60 });
    const legCost = 300;
    const topCost = 1200;

    const items = [
      {
        tenantId,
        productId: leg.id,
        quantity: legQty,
        unitCost: legCost,
        uomId: piece.id,
        lineTotal: legQty * legCost,
      },
      {
        tenantId,
        productId: top.id,
        quantity: topQty,
        unitCost: topCost,
        uomId: piece.id,
        lineTotal: topQty * topCost,
      },
    ];

    const totalAmount = items.reduce((acc, it) => acc + it.lineTotal, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: supplier.id,
        status: 'RECEIVED',
        orderDate,
        expectedDate: orderDate,
        totalAmount,
        items: {
          create: items,
        },
      },
    });

    // Record GL entries for procurement
    await accounting.recordPurchaseOrderReceipt(po.id);
  }

  // Basic BOM: 4 legs + 1 top -> 1 table
  const bom = await prisma.billOfMaterial.create({
    data: {
      tenantId,
      productId: table.id,
      name: 'Dining Table – Standard BOM',
      isActive: true,
      items: {
        create: [
          {
            tenantId,
            componentProductId: leg.id,
            uomId: piece.id,
            quantity: 4,
          },
          {
            tenantId,
            componentProductId: top.id,
            uomId: piece.id,
            quantity: 1,
          },
        ],
      },
    },
  });

  // Production orders over the last year
  const productionOrderCount = 80;

  for (let i = 0; i < productionOrderCount; i++) {
    const startedAt = faker.date.between({ from: start, to: now });
    const completedAt = new Date(
      startedAt.getTime() + faker.number.int({ min: 1, max: 5 }) * 24 * 60 * 60 * 1000,
    );
    const quantity = faker.number.int({ min: 1, max: 3 });

    await prisma.productionOrder.create({
      data: {
        tenantId,
        bomId: bom.id,
        productId: table.id,
        locationId: location.id,
        quantity,
        status: 'COMPLETED',
        startedAt,
        completedAt,
      },
    });
  }

  // Customers and finished goods sales
  const customers = await seedCustomers(tenantId);
  await seedInvoices(tenantId, location.id, [table], customers, 400);
}

async function seedConstructionTenant(tenantId: string) {
  // Construction units
  const bag = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Bag',
      category: 'Unit',
      ratio: 1,
    },
  });
  const ton = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Ton',
      category: 'Weight',
      ratio: 1,
    },
  });
  const day = await prisma.unitOfMeasure.create({
    data: {
      tenantId,
      name: 'Day',
      category: 'Time',
      ratio: 1,
    },
  });

  const yard = await prisma.location.create({
    data: {
      tenantId,
      name: 'Construction Yard & Stores',
      code: 'YARD',
      isActive: true,
    },
  });

  // Materials and labour products
  const cement = await prisma.product.create({
    data: {
      tenantId,
      name: 'OPC Cement 50kg Bag',
      sku: 'CEM-50KG',
      defaultUomId: bag.id,
      category: 'Material',
      defaultPrice: 750,
      minStockQuantity: 200,
    },
  });

  const steel = await prisma.product.create({
    data: {
      tenantId,
      name: 'Deformed Steel Bars (Ton)',
      sku: 'STEEL-TON',
      defaultUomId: ton.id,
      category: 'Material',
      defaultPrice: 120000,
      minStockQuantity: 20,
    },
  });

  const sand = await prisma.product.create({
    data: {
      tenantId,
      name: 'Sand – Tipper Load (Ton)',
      sku: 'SAND-TON',
      defaultUomId: ton.id,
      category: 'Material',
      defaultPrice: 3500,
      minStockQuantity: 30,
    },
  });

  const labour = await prisma.product.create({
    data: {
      tenantId,
      name: 'Construction Labour Day',
      sku: 'LABOUR-DAY',
      defaultUomId: day.id,
      category: 'Service',
      defaultPrice: 8000,
      minStockQuantity: 0,
    },
  });

  await prisma.stockQuant.createMany({
    data: [
      {
        tenantId,
        productId: cement.id,
        locationId: yard.id,
        batchId: null,
        uomId: bag.id,
        quantity: 5000,
      },
      {
        tenantId,
        productId: steel.id,
        locationId: yard.id,
        batchId: null,
        uomId: ton.id,
        quantity: 200,
      },
      {
        tenantId,
        productId: sand.id,
        locationId: yard.id,
        batchId: null,
        uomId: ton.id,
        quantity: 300,
      },
    ],
  });

  // Projects
  const projectA = await prisma.project.create({
    data: {
      tenantId,
      name: 'Riverfront Apartments Phase 1',
      code: 'RIV-APT-P1',
      status: 'OPEN',
      startDate: new Date(new Date().getFullYear(), 0, 15),
      endDate: null,
    },
  });

  const projectB = await prisma.project.create({
    data: {
      tenantId,
      name: 'Eastern Bypass Warehouses',
      code: 'EB-WAREHOUSES',
      status: 'OPEN',
      startDate: new Date(new Date().getFullYear(), 1, 10),
      endDate: null,
    },
  });

  // Suppliers
  const suppliers = [
    await prisma.supplier.create({
      data: {
        tenantId,
        name: 'KenCem Cement Distributors',
        phone: randomKenyanPhone(),
        email: 'sales@kencem.co.ke',
        kraPin: `P${faker.string.alphanumeric(9).toUpperCase()}`,
      },
    }),
    await prisma.supplier.create({
      data: {
        tenantId,
        name: 'Nairobi Steel & Hardware',
        phone: randomKenyanPhone(),
        email: 'orders@nsteelhardware.co.ke',
        kraPin: `A${faker.string.alphanumeric(9).toUpperCase()}`,
      },
    }),
  ];

  const accounting = new AccountingService(tenantId);
  const now = new Date();
  const start = new Date(now);
  start.setMonth(now.getMonth() - 12);

  // Project-coded purchase orders (job costs)
  const poCount = 40;
  const materialProducts = [cement, steel, sand];

  for (let i = 0; i < poCount; i++) {
    const orderDate = faker.date.between({ from: start, to: now });
    const project = i % 2 === 0 ? projectA : projectB;
    const supplier = faker.helpers.arrayElement(suppliers);

    const lineCount = faker.number.int({ min: 1, max: 3 });
    const items: any[] = [];
    let totalAmount = 0;

    for (let j = 0; j < lineCount; j++) {
      const product = faker.helpers.arrayElement(materialProducts);
      const quantity =
        product.id === cement.id
          ? faker.number.int({ min: 100, max: 600 })
          : faker.number.int({ min: 5, max: 40 });
      const unitCost =
        product.id === cement.id
          ? 750
          : product.id === steel.id
          ? 120000
          : 3500;
      const lineTotal = quantity * unitCost;
      totalAmount += lineTotal;

      items.push({
        tenantId,
        productId: product.id,
        quantity,
        unitCost,
        uomId: product.defaultUomId,
        lineTotal,
      });
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: supplier.id,
        projectId: project.id,
        status: 'RECEIVED',
        orderDate,
        expectedDate: orderDate,
        totalAmount,
        items: {
          create: items,
        },
      },
    });

    await accounting.recordPurchaseOrderReceipt(po.id);
  }

  // Customers (developers / government)
  const customers: any[] = [];
  customers.push(
    await prisma.customer.create({
      data: {
        tenantId,
        name: 'Karibu Homes Developers',
        phone: randomKenyanPhone(),
        email: 'accounts@karibu-homes.co.ke',
        kraPin: `P${faker.string.alphanumeric(9).toUpperCase()}`,
      },
    }),
  );
  customers.push(
    await prisma.customer.create({
      data: {
        tenantId,
        name: 'County Govt of Kajiado',
        phone: randomKenyanPhone(),
        email: 'finance@kajiado.go.ke',
        kraPin: `G${faker.string.alphanumeric(9).toUpperCase()}`,
      },
    }),
  );

  // Project-coded invoices (revenue side)
  const invoiceCountPerProject = 200;

  for (const project of [projectA, projectB]) {
    for (let i = 0; i < invoiceCountPerProject; i++) {
      const issueDate = faker.date.between({ from: start, to: now });
      const customer = faker.helpers.arrayElement(customers);

      const days = faker.number.int({ min: 5, max: 30 });
      const dayRate = faker.number.int({ min: 5000, max: 15000 });
      const baseAmount = days * dayRate;

      const paymentRoll = Math.random();
      let status: 'Paid' | 'Partial' | 'Posted';
      let paidAmount = 0;

      if (paymentRoll < 0.7) {
        status = 'Paid';
        paidAmount = baseAmount;
      } else if (paymentRoll < 0.85) {
        status = 'Partial';
        const fraction = faker.number.int({ min: 10, max: 80 }) / 100;
        paidAmount = Math.round(baseAmount * fraction);
      } else {
        status = 'Posted';
        paidAmount = 0;
      }

      const invoice = await prisma.invoice.create({
        data: {
          tenantId,
          customerId: customer.id,
          projectId: project.id,
          invoiceNo: `PRJ-${project.code}-${faker.string.numeric(4)}`,
          status,
          issueDate,
          totalAmount: baseAmount,
          items: {
            create: [
              {
                tenantId,
                productId: labour.id,
                quantity: days,
                unitPrice: dayRate,
                uomId: day.id,
                lineTotal: baseAmount,
                hsCode: '998721',
                taxRate: TaxRate.VAT_16,
              },
            ],
          },
        },
      });

      if (paidAmount > 0) {
        await prisma.transaction.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            amount: paidAmount,
            type: 'Credit',
            reference:
              status === 'Paid'
                ? `Project payment for ${invoice.invoiceNo}`
                : `Partial project payment for ${invoice.invoiceNo}`,
            createdAt: issueDate,
          },
        });
      }
    }
  }
}

// Seed extra fixtures so that analytics/risk cards light up for demo tenants.
async function seedRiskAndCouponFixtures(
  tenantId: string,
  locationId: string,
  products: any[],
) {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - 90);

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      issueDate: {
        gte: windowStart,
      },
    },
  });

  if (invoices.length === 0) {
    return;
  }

  // Demo coupon used on a subset of invoices so COUPON_APPLIED appears in SystemLog.
  const coupon = await prisma.coupon.create({
    data: {
      tenantId,
      code: 'FUNDIS10',
      description: '10% off tools (demo coupon)',
      percentageOff: 0.1,
      amountOff: null,
      active: true,
      validFrom: windowStart,
      validTo: now,
      maxUses: 500,
      minSubtotal: 500,
    },
  });

  const couponTargets = invoices.slice(0, 10);
  for (const invoice of couponTargets) {
    const subtotal = Number(invoice.totalAmount || 0);
    if (!subtotal) continue;

    const discountAmount = Math.round(subtotal * 0.1);

    await prisma.couponRedemption.create({
      data: {
        tenantId,
        couponId: coupon.id,
        invoiceId: invoice.id,
        discount: discountAmount,
      },
    });

    await prisma.systemLog.create({
      data: {
        tenantId,
        userId: null,
        action: 'COUPON_APPLIED',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: {
          couponCode: coupon.code,
          discountAmount,
          seeded: true,
        },
      },
    });
  }

  // Mark a few invoices as training so trainingInvoices metric is non-zero.
  const trainingTargets = invoices.slice(0, 5);
  for (const invoice of trainingTargets) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { isTraining: true },
    });
  }

  // Create a handful of manual payments with corresponding SystemLog entries.
  let manualCount = 0;
  for (const invoice of invoices) {
    if (manualCount >= 5) break;

    const existingAgg = await prisma.transaction.aggregate({
      where: {
        tenantId,
        invoiceId: invoice.id,
        type: 'Credit',
      },
      _sum: {
        amount: true,
      },
    });

    const alreadyPaid = Number(existingAgg._sum.amount || 0);
    if (alreadyPaid > 0) {
      continue;
    }

    const total = Number(invoice.totalAmount || 0);
    if (!total) continue;

    const amount = Math.max(1, Math.round(total * 0.4));
    const newStatus = amount >= total ? 'Paid' : 'Partial';

    await prisma.transaction.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        amount,
        type: 'Credit',
        reference: `Manual seed payment for ${invoice.invoiceNo}`,
      },
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: newStatus },
    });

    await prisma.systemLog.create({
      data: {
        tenantId,
        userId: null,
        action: 'INVOICE_PAID_MANUAL',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: {
          amount,
          previousStatus: invoice.status,
          newStatus,
          seeded: true,
        },
      },
    });

    manualCount += 1;
  }

  // Create a small blind stocktake variance so STOCKTAKE_VARIANCE appears.
  const adminUser = await prisma.user.findFirst({
    where: {
      tenantId,
      role: UserRole.ADMIN,
    },
  });

  const anyProduct = products[0];

  if (adminUser && anyProduct) {
    const stockTake = await prisma.stockTake.create({
      data: {
        tenantId,
        locationId,
        createdByUserId: adminUser.id,
        status: 'OPEN',
      },
    });

    const expectedQuantity = 100;
    const countedQuantity = 92;
    const variance = countedQuantity - expectedQuantity;

    const item = await prisma.stockTakeItem.create({
      data: {
        tenantId,
        stockTakeId: stockTake.id,
        productId: anyProduct.id,
        expectedQuantity,
        countedQuantity,
        variance,
        status: 'COUNTED',
      },
    });

    await prisma.systemLog.create({
      data: {
        tenantId,
        userId: adminUser.id,
        action: 'STOCKTAKE_VARIANCE',
        entityType: 'StockTakeItem',
        entityId: item.id,
        metadata: {
          productId: anyProduct.id,
          locationId,
          expectedQuantity,
          countedQuantity,
          variance,
          stockTakeId: stockTake.id,
          seeded: true,
        },
      },
    });
  }
}

async function main() {
  console.log('Seeding database with realistic Kenyan data...');

  // Wipe data in dependency order
  await prisma.systemLog.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.glJournalLine.deleteMany({});
  await prisma.glJournalEntry.deleteMany({});
  await prisma.glAccount.deleteMany({});
  await prisma.stockTransferItem.deleteMany({});
  await prisma.stockTransfer.deleteMany({});
  await prisma.stockTakeItem.deleteMany({});
  await prisma.stockTake.deleteMany({});
  await prisma.billOfMaterialItem.deleteMany({});
  await prisma.productionOrder.deleteMany({});
  await prisma.billOfMaterial.deleteMany({});
  await prisma.productBatch.deleteMany({});
  await prisma.stockQuant.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.loanGuarantor.deleteMany({});
  await prisma.loan.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.chamaConstitution.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.unitOfMeasure.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  const {
    nuru,
    wamama,
    safari,
    stMarys,
    greenLeaf,
    nairobiFurniture,
    cityBuilders,
  } = await createTenants();

  await createUsers(nuru.id);
  await createUsers(wamama.id);
  await createUsers(safari.id);
  await createUsers(stMarys.id);
  await createUsers(greenLeaf.id);
  await createUsers(nairobiFurniture.id);
  await createUsers(cityBuilders.id);
  await createDefaultAdmin(nuru.id);

  // Ensure a basic chart of accounts for all tenants
  await new AccountingService(nuru.id).ensureDefaultAccounts();
  await new AccountingService(wamama.id).ensureDefaultAccounts();
  await new AccountingService(safari.id).ensureDefaultAccounts();
  await new AccountingService(stMarys.id).ensureDefaultAccounts();
  await new AccountingService(greenLeaf.id).ensureDefaultAccounts();
  await new AccountingService(nairobiFurniture.id).ensureDefaultAccounts();
  await new AccountingService(cityBuilders.id).ensureDefaultAccounts();

  const { products, location } = await seedInventory(nuru.id);
  const customers = await seedCustomers(nuru.id);
  await seedInvoices(nuru.id, location.id, products, customers);
  await seedRiskAndCouponFixtures(nuru.id, location.id, products);

  await seedChama(wamama.id);
  // Fleet / service business seed
  await seedFleetTenant(safari.id);
  // School tenant seed
  await seedSchoolTenant(stMarys.id);
  // Agrovet tenant seed
  await seedAgrovetTenant(greenLeaf.id);
  // Manufacturing tenant seed (furniture / BOM / production)
  await seedManufacturingTenant(nairobiFurniture.id);
  // Construction tenant seed (projects / job costing)
  await seedConstructionTenant(cityBuilders.id);

  // Normalise any negative stock that might have occurred due to randomised seeding
  await prisma.stockQuant.updateMany({
    where: { quantity: { lt: 0 } },
    data: { quantity: 0 },
  });

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