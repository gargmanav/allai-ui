import { db } from './db';
import { 
  contractorCustomers, 
  quotes, 
  quoteLineItems,
  smartCases,
  appointments,
  reminders,
  vendors,
  scheduledJobs
} from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

const CONTRACTOR_USER_ID = '82898170-3df5-46c9-a0c2-04590ca5953f';
const CONTRACTOR_ORG_ID = 'c117e05e-725b-4b0a-8796-b4bebd1e1aee';
const CONTRACTOR_VENDOR_ID = '5456db9d-fca4-4291-aa4a-6b981e28548b';

async function seedContractorTestData() {
  console.log('🌱 Seeding contractor test data...');
  
  // Skip cleanup to avoid foreign key cascade issues - just add new data
  console.log('Adding test data (without cleanup to avoid FK issues)...');
  
  const vendorResult = await db.select().from(vendors).where(eq(vendors.userId, CONTRACTOR_USER_ID)).limit(1);
  const vendorId = vendorResult[0]?.id;
  
  if (!vendorId) {
    console.log('❌ No vendor found for contractor user. Skipping vendor-dependent data.');
  }
  
  const customers = [
    { name: 'Sarah Mitchell', email: 'sarah.mitchell@email.com', phone: '(555) 123-4567', company: 'Mitchell Estates', notes: 'Prefers morning appointments' },
    { name: 'James Rodriguez', email: 'james.r@realty.com', phone: '(555) 234-5678', company: 'Rodriguez Properties LLC', notes: 'Manages 12 units downtown' },
    { name: 'Emily Chen', email: 'echen@outlook.com', phone: '(555) 345-6789', company: '', notes: 'Single family home owner' },
    { name: 'Michael Thompson', email: 'mthompson@gmail.com', phone: '(555) 456-7890', company: 'Thompson & Associates', notes: 'Commercial properties only' },
    { name: 'Lisa Wang', email: 'lwang@propertygroup.com', phone: '(555) 567-8901', company: 'Apex Property Group', notes: 'Urgent jobs, premium client' },
    { name: 'Robert Garcia', email: 'rgarcia@email.com', phone: '(555) 678-9012', company: '', notes: 'Referral from James' },
    { name: 'Amanda Foster', email: 'afoster@homes.com', phone: '(555) 789-0123', company: 'Foster Homes Inc', notes: 'New construction specialist' },
  ];
  
  console.log('Creating customers...');
  const createdCustomers: any[] = [];
  for (const customer of customers) {
    const [created] = await db.insert(contractorCustomers).values({
      ...customer,
      contractorId: CONTRACTOR_USER_ID,
    }).returning();
    createdCustomers.push(created);
  }
  console.log(`✅ Created ${createdCustomers.length} customers`);
  
  console.log('Creating quotes...');
  const now = new Date();
  const quotesData = [
    { customer: createdCustomers[0], title: 'Water Heater Replacement', status: 'draft', subtotal: '850.00', taxAmount: '68.00', total: '918.00', items: [
      { description: 'Water heater replacement - 50 gallon', quantity: 1, rate: '650.00', amount: '650.00' },
      { description: 'Labor and installation', quantity: 2, rate: '100.00', amount: '200.00' },
    ]},
    { customer: createdCustomers[1], title: 'Bathroom Remodel - Unit 4B', status: 'sent', subtotal: '2400.00', taxAmount: '192.00', total: '2592.00', expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), items: [
      { description: 'Full bathroom remodel - materials', quantity: 1, rate: '1800.00', amount: '1800.00' },
      { description: 'Labor (estimated 6 hours)', quantity: 6, rate: '100.00', amount: '600.00' },
    ]},
    { customer: createdCustomers[2], title: 'Garbage Disposal Repair', status: 'sent', subtotal: '450.00', taxAmount: '36.00', total: '486.00', expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), items: [
      { description: 'Garbage disposal replacement', quantity: 1, rate: '250.00', amount: '250.00' },
      { description: 'Installation labor', quantity: 2, rate: '100.00', amount: '200.00' },
    ]},
    { customer: createdCustomers[3], title: 'Commercial HVAC Repair', status: 'approved', subtotal: '3200.00', taxAmount: '256.00', total: '3456.00', items: [
      { description: 'Commercial HVAC repair', quantity: 1, rate: '2400.00', amount: '2400.00' },
      { description: 'Parts and materials', quantity: 1, rate: '800.00', amount: '800.00' },
    ]},
    { customer: createdCustomers[4], title: 'Emergency Plumbing Repair', status: 'approved', subtotal: '1500.00', taxAmount: '120.00', total: '1620.00', items: [
      { description: 'Emergency plumbing repair', quantity: 1, rate: '1200.00', amount: '1200.00' },
      { description: 'After-hours service fee', quantity: 1, rate: '300.00', amount: '300.00' },
    ]},
    { customer: createdCustomers[5], title: 'Kitchen Fixture Installation', status: 'sent', subtotal: '780.00', taxAmount: '62.40', total: '842.40', expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), items: [
      { description: 'Kitchen faucet replacement', quantity: 1, rate: '280.00', amount: '280.00' },
      { description: 'Dishwasher hookup repair', quantity: 1, rate: '350.00', amount: '350.00' },
      { description: 'Service call fee', quantity: 1, rate: '150.00', amount: '150.00' },
    ]},
    { customer: createdCustomers[0], title: 'Water Heater Annual Service', status: 'expired', subtotal: '1100.00', taxAmount: '88.00', total: '1188.00', expiresAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), items: [
      { description: 'Water heater service', quantity: 1, rate: '1100.00', amount: '1100.00' },
    ]},
  ];
  
  for (const quoteData of quotesData) {
    const [quote] = await db.insert(quotes).values({
      contractorId: CONTRACTOR_USER_ID,
      customerId: quoteData.customer.id,
      title: quoteData.title,
      status: quoteData.status as any,
      subtotal: quoteData.subtotal,
      taxPercent: '8.00',
      taxAmount: quoteData.taxAmount,
      total: quoteData.total,
      expiresAt: quoteData.expiresAt,
      depositType: 'percent',
      depositValue: '25.00',
    }).returning();
    
    let displayOrder = 0;
    for (const item of quoteData.items) {
      await db.insert(quoteLineItems).values({
        quoteId: quote.id,
        name: item.description.split(' - ')[0],
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.rate,
        total: item.amount,
        displayOrder: displayOrder++,
      });
    }
  }
  console.log(`✅ Created ${quotesData.length} quotes with line items`);

  console.log('Creating work orders (jobs)...');
  const workOrdersData = [
    { customer: createdCustomers[0], title: 'Water heater replacement', status: 'New', priority: 'High', category: 'Plumbing', estimatedCost: 918, description: 'Replace failing 50-gallon water heater' },
    { customer: createdCustomers[1], title: 'Bathroom remodel - Unit 4B', status: 'In Progress', priority: 'Normal', category: 'Renovation', estimatedCost: 2592, description: 'Full bathroom renovation including fixtures' },
    { customer: createdCustomers[2], title: 'Garbage disposal repair', status: 'New', priority: 'Normal', category: 'Appliance', estimatedCost: 486, description: 'Disposal making grinding noise, may need replacement' },
    { customer: createdCustomers[3], title: 'HVAC system maintenance', status: 'Scheduled', priority: 'Normal', category: 'HVAC', estimatedCost: 3456, description: 'Annual commercial HVAC maintenance and filter replacement' },
    { customer: createdCustomers[4], title: 'Emergency leak repair', status: 'In Progress', priority: 'Urgent', category: 'Plumbing', estimatedCost: 1620, description: 'Water leak from second floor bathroom affecting unit below' },
    { customer: createdCustomers[5], title: 'Kitchen fixture installation', status: 'New', priority: 'Normal', category: 'Plumbing', estimatedCost: 842, description: 'Install new kitchen faucet and connect dishwasher' },
    { customer: createdCustomers[6], title: 'Electrical panel upgrade', status: 'In Review', priority: 'High', category: 'Electrical', estimatedCost: 2800, description: 'Upgrade from 100A to 200A panel' },
    { customer: createdCustomers[0], title: 'Toilet replacement - Master bath', status: 'Resolved', priority: 'Normal', category: 'Plumbing', estimatedCost: 650, actualCost: 680, description: 'Replace old toilet with water-efficient model' },
    { customer: createdCustomers[1], title: 'Window repair - Unit 2A', status: 'Closed', priority: 'Normal', category: 'General', estimatedCost: 350, actualCost: 325, description: 'Fix broken window latch and seal' },
    { customer: createdCustomers[3], title: 'Roof inspection', status: 'In Review', priority: 'Normal', category: 'Roofing', estimatedCost: 500, description: 'Annual roof inspection and minor repairs' },
  ];
  
  const createdCases: any[] = [];
  for (const wo of workOrdersData) {
    const [created] = await db.insert(smartCases).values({
      title: wo.title,
      description: wo.description,
      status: wo.status as any,
      priority: wo.priority as any,
      category: wo.category,
      estimatedCost: wo.estimatedCost,
      actualCost: wo.actualCost,
      customerId: wo.customer.id,
      assignedContractorId: CONTRACTOR_VENDOR_ID,
      orgId: CONTRACTOR_ORG_ID,
    }).returning();
    createdCases.push(created);
  }
  console.log(`✅ Created ${createdCases.length} work orders`);

  console.log('Creating appointments...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const appointmentsData = [
    { case: createdCases[0], startHour: 9, duration: 2, status: 'Confirmed' },
    { case: createdCases[1], startHour: 11, duration: 3, status: 'Confirmed' },
    { case: createdCases[3], startHour: 14, duration: 2, status: 'Pending' },
    { case: createdCases[4], startHour: 16, duration: 1, status: 'In Progress' },
  ];
  
  for (const apt of appointmentsData) {
    const startAt = new Date(today);
    startAt.setHours(apt.startHour, 0, 0, 0);
    const endAt = new Date(startAt);
    endAt.setHours(startAt.getHours() + apt.duration);
    
    await db.insert(appointments).values({
      caseId: apt.case.id,
      contractorId: CONTRACTOR_VENDOR_ID,
      orgId: CONTRACTOR_ORG_ID,
      title: apt.case.title,
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
      status: apt.status as any,
      notes: `Appointment for ${apt.case.title}`,
    });
  }
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow);
  tomorrowStart.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(12, 0, 0, 0);
  
  await db.insert(appointments).values({
    caseId: createdCases[2].id,
    contractorId: CONTRACTOR_VENDOR_ID,
    orgId: CONTRACTOR_ORG_ID,
    title: 'Garbage disposal repair - follow up',
    scheduledStartAt: tomorrowStart,
    scheduledEndAt: tomorrowEnd,
    status: 'Pending' as any,
    notes: 'Follow-up appointment',
  });
  
  console.log('✅ Created 5 appointments');

  console.log('Creating reminders...');
  const remindersData = [
    { title: 'Follow up with Sarah Mitchell', dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) },
    { title: 'Order parts for bathroom remodel', dueAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) },
    { title: 'Submit permit application', dueAt: today },
    { title: 'Invoice Thompson & Associates', dueAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    { title: 'Schedule annual service - Foster Homes', dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
  ];
  
  for (const reminder of remindersData) {
    await db.insert(reminders).values({
      orgId: CONTRACTOR_ORG_ID,
      title: reminder.title,
      dueAt: reminder.dueAt,
      status: 'active',
    });
  }
  console.log('✅ Created 5 reminders');

  console.log('🎉 Contractor test data seeding complete!');
}

seedContractorTestData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
