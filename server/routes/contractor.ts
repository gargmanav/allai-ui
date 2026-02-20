import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { getMarketplaceCases, acceptCase } from '../services/contractorMarketplace';
import { db } from '../db';
import { smartCases, caseMedia, contractorOrgLinks, organizationMembers, users, properties, contractorCustomers, insertContractorCustomerSchema, vendors, quotes, quoteLineItems, quoteCounterProposals, insertQuoteSchema, insertQuoteLineItemSchema, insertQuoteCounterProposalSchema, contractorTeamMembers, contactTeamMembers, appointments, scheduledJobs, teams, contractorDismissedCases, reminders, messageThreads, chatMessages } from '@shared/schema';
import { eq, and, inArray, or, sql, isNotNull } from 'drizzle-orm';
import { storage } from '../storage';
import { generateApprovalToken } from '../utils/tokens';
import { aiTriageService } from '../aiTriage';

const router = Router();

// Get all cases for contractor (assigned + marketplace)
router.get('/cases', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const cases = await db.query.smartCases.findMany({
      where: eq(smartCases.assignedContractorId, contractorUserId),
      with: {
        property: true,
        unit: true,
        customer: true,
        media: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
    });
    const mapped = cases.map(c => ({
      ...c,
      customer: c.customer ? { id: c.customer.id, name: [c.customer.firstName, c.customer.lastName].filter(Boolean).join(' ') || c.customer.email || 'Customer', email: c.customer.email, phone: c.customer.phone } : undefined,
    }));
    res.json(mapped);
  } catch (error) {
    console.error('Error fetching contractor cases:', error);
    res.status(500).json({ error: 'Failed to fetch contractor cases' });
  }
});

// Get marketplace cases for contractor
router.get('/marketplace', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const cases = await getMarketplaceCases(contractorUserId);
    res.json(cases);
  } catch (error) {
    console.error('Error fetching marketplace cases:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace cases' });
  }
});

// Get a single case by ID (for quote context)
router.get('/cases/:caseId', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const { caseId } = req.params;
    const caseRecord = await db.query.smartCases.findFirst({
      where: eq(smartCases.id, caseId),
      with: {
        property: true,
        unit: true,
        media: true,
      },
    });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.json(caseRecord);

    const media = (caseRecord as any).media || [];
    const hasPhotos = media.some((m: any) => m.type?.startsWith('image') && m.url);
    const hasAnalysis = (caseRecord as any).aiTriageJson?.photoAnalysis?.contractor;
    if (hasPhotos && !hasAnalysis) {
      const photoUrls = media.filter((m: any) => m.type?.startsWith('image')).map((m: any) => m.url);
      aiTriageService.generatePhotoAnalysis(photoUrls, caseRecord.title, caseRecord.description || '').then(async (analysis) => {
        if (analysis) {
          const existingTriage = (caseRecord as any).aiTriageJson || {};
          await db.update(smartCases).set({ aiTriageJson: { ...existingTriage, photoAnalysis: analysis } }).where(eq(smartCases.id, caseId));
          console.log(`🤖 Photo analysis generated for case ${caseId}`);
        }
      }).catch(err => console.error('Photo analysis error:', err));
    }
  } catch (error) {
    console.error('Error fetching case detail:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

router.post('/cases/:caseId/analyze-photos', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const { caseId } = req.params;
    const caseRecord = await db.query.smartCases.findFirst({
      where: eq(smartCases.id, caseId),
      with: { media: true },
    });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const existingTriage = (caseRecord as any).aiTriageJson || {};
    if (existingTriage.photoAnalysis?.contractor) {
      return res.json({ photoAnalysis: existingTriage.photoAnalysis });
    }
    const media = (caseRecord as any).media || [];
    const photos = media.filter((m: any) => m.type?.startsWith('image') && m.url);
    if (photos.length === 0) {
      return res.status(400).json({ error: 'No photos to analyze' });
    }
    const photoUrls = photos.map((m: any) => m.url);
    const analysis = await aiTriageService.generatePhotoAnalysis(photoUrls, caseRecord.title, caseRecord.description || '');
    if (analysis) {
      await db.update(smartCases).set({ aiTriageJson: { ...existingTriage, photoAnalysis: analysis } }).where(eq(smartCases.id, caseId));
      console.log(`🤖 Photo analysis generated for case ${caseId}`);
      return res.json({ photoAnalysis: analysis });
    }
    res.status(500).json({ error: 'Analysis failed' });
  } catch (error) {
    console.error('Error analyzing photos:', error);
    res.status(500).json({ error: 'Failed to analyze photos' });
  }
});

// ============================================================================
// JOB LIFECYCLE ENDPOINTS
// ============================================================================

// Confirm a job after quote approval - contractor confirms start date
router.post('/cases/:caseId/confirm-job', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { caseId } = req.params;
    const { confirmedStartDate, estimatedDays, notes } = req.body;

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.assignedContractorId, contractorUserId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found or not assigned to you' });
    }

    if (caseRecord.status !== 'In Review' && caseRecord.status !== 'Scheduled') {
      return res.status(400).json({ error: 'Case is not awaiting confirmation or scheduling' });
    }

    const startDate = confirmedStartDate ? new Date(confirmedStartDate) : null;
    const endDate = startDate && estimatedDays 
      ? new Date(startDate.getTime() + (estimatedDays * 24 * 60 * 60 * 1000))
      : null;

    await db.update(smartCases)
      .set({
        status: 'Scheduled',
        scheduledStartAt: startDate,
        scheduledEndAt: endDate,
        estimatedDuration: estimatedDays ? `${estimatedDays} days` : null,
        updatedAt: new Date(),
      })
      .where(eq(smartCases.id, caseId));

    // Create a reminder for the start date if provided
    if (startDate && caseRecord.orgId) {
      try {
        await db.insert(reminders).values({
          orgId: caseRecord.orgId,
          title: `Job starting: ${caseRecord.title}`,
          type: 'maintenance',
          scope: 'property',
          scopeId: caseRecord.propertyId || undefined,
          dueAt: startDate,
          leadDays: 1,
          status: 'pending',
          channels: ['inapp'],
          payloadJson: { caseId, contractorId: contractorUserId, notes },
        });
      } catch (reminderError) {
        console.error('Error creating reminder:', reminderError);
      }
    }

    // Auto-insert system message to homeowner thread
    try {
      const contractorUser = await db.query.users.findFirst({
        where: eq(users.id, contractorUserId),
      });
      const contractorName = contractorUser?.fullName || contractorUser?.username || 'Your contractor';
      
      const thread = await db.query.messageThreads.findFirst({
        where: and(
          eq(messageThreads.caseId, caseId),
          eq(messageThreads.contractorUserId, contractorUserId)
        ),
      });

      if (thread) {
        const dateStr = startDate ? startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null;
        const msgParts = [`${contractorName} has confirmed the job`];
        if (dateStr) msgParts.push(`and is scheduled to start on ${dateStr}`);
        if (estimatedDays) msgParts.push(`(estimated ${estimatedDays} day${estimatedDays > 1 ? 's' : ''})`);
        if (notes) msgParts.push(`\n\nNote: ${notes}`);

        await db.insert(chatMessages).values({
          threadId: thread.id,
          senderId: contractorUserId,
          body: msgParts.join(' '),
          isRead: false,
        });

        await db.update(messageThreads)
          .set({ lastMessageAt: new Date(), lastMessagePreview: msgParts.join(' ').substring(0, 100) })
          .where(eq(messageThreads.id, thread.id));
      }
    } catch (msgError) {
      console.error('Error sending confirmation message:', msgError);
    }

    res.json({ success: true, message: 'Job confirmed and scheduled' });
  } catch (error) {
    console.error('Error confirming job:', error);
    res.status(500).json({ error: 'Failed to confirm job' });
  }
});

// Start a job - move from Scheduled to In Progress
router.post('/cases/:caseId/start-job', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { caseId } = req.params;

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.assignedContractorId, contractorUserId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found or not assigned to you' });
    }

    if (caseRecord.status !== 'Scheduled') {
      return res.status(400).json({ error: 'Job must be scheduled before starting' });
    }

    await db.update(smartCases)
      .set({
        status: 'In Progress',
        updatedAt: new Date(),
      })
      .where(eq(smartCases.id, caseId));

    // Auto-insert system message
    try {
      const contractorUser = await db.query.users.findFirst({ where: eq(users.id, contractorUserId) });
      const contractorName = contractorUser?.fullName || contractorUser?.username || 'Your contractor';
      const thread = await db.query.messageThreads.findFirst({
        where: and(eq(messageThreads.caseId, caseId), eq(messageThreads.contractorUserId, contractorUserId)),
      });
      if (thread) {
        const body = `${contractorName} has started work on this job.`;
        await db.insert(chatMessages).values({ threadId: thread.id, senderId: contractorUserId, body, isRead: false });
        await db.update(messageThreads).set({ lastMessageAt: new Date(), lastMessagePreview: body.substring(0, 100) }).where(eq(messageThreads.id, thread.id));
      }
    } catch (msgError) {
      console.error('Error sending start message:', msgError);
    }

    res.json({ success: true, message: 'Job started' });
  } catch (error) {
    console.error('Error starting job:', error);
    res.status(500).json({ error: 'Failed to start job' });
  }
});

// Complete a job - move from In Progress to Resolved
router.post('/cases/:caseId/complete-job', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { caseId } = req.params;
    const { completionNotes } = req.body;

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.assignedContractorId, contractorUserId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found or not assigned to you' });
    }

    if (caseRecord.status !== 'In Progress') {
      return res.status(400).json({ error: 'Job must be in progress before completing' });
    }

    await db.update(smartCases)
      .set({
        status: 'Resolved',
        updatedAt: new Date(),
      })
      .where(eq(smartCases.id, caseId));

    // Auto-insert system message
    try {
      const contractorUser = await db.query.users.findFirst({ where: eq(users.id, contractorUserId) });
      const contractorName = contractorUser?.fullName || contractorUser?.username || 'Your contractor';
      const thread = await db.query.messageThreads.findFirst({
        where: and(eq(messageThreads.caseId, caseId), eq(messageThreads.contractorUserId, contractorUserId)),
      });
      if (thread) {
        const body = `${contractorName} has marked this job as completed.${completionNotes ? `\n\nCompletion notes: ${completionNotes}` : ''}`;
        await db.insert(chatMessages).values({ threadId: thread.id, senderId: contractorUserId, body, isRead: false });
        await db.update(messageThreads).set({ lastMessageAt: new Date(), lastMessagePreview: body.substring(0, 100) }).where(eq(messageThreads.id, thread.id));
      }
    } catch (msgError) {
      console.error('Error sending completion message:', msgError);
    }

    res.json({ success: true, message: 'Job completed' });
  } catch (error) {
    console.error('Error completing job:', error);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// Get assigned cases for contractor
router.get('/assigned-cases', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const cases = await db.query.smartCases.findMany({
      where: eq(smartCases.assignedContractorId, contractorUserId),
      with: {
        property: true,
        unit: true,
        customer: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
    });
    const mapped = cases.map(c => ({
      ...c,
      customer: c.customer ? { id: c.customer.id, name: [c.customer.firstName, c.customer.lastName].filter(Boolean).join(' ') || c.customer.email || 'Customer', email: c.customer.email, phone: c.customer.phone } : undefined,
    }));
    res.json(mapped);
  } catch (error) {
    console.error('Error fetching assigned cases:', error);
    res.status(500).json({ error: 'Failed to fetch assigned cases' });
  }
});

// Accept a marketplace case (with optional pricing)
router.post('/accept-case', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { caseId, quotedPrice, priceTbd, availableStartDate, availableEndDate, estimatedDays } = req.body;
    
    if (!caseId) {
      return res.status(400).json({ error: 'Case ID is required' });
    }
    
    const result = await acceptCase(contractorUserId, caseId, {
      quotedPrice: quotedPrice ? String(quotedPrice) : undefined,
      priceTbd: !!priceTbd,
      availableStartDate: availableStartDate || undefined,
      availableEndDate: availableEndDate || undefined,
      estimatedDays: estimatedDays ? parseInt(estimatedDays) : undefined,
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, message: 'Case accepted successfully' });
  } catch (error) {
    console.error('Error accepting case:', error);
    res.status(500).json({ error: 'Failed to accept case' });
  }
});

// Dismiss/pass on a case
router.post('/dismiss-case', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { caseId, reason } = req.body;
    
    if (!caseId) {
      return res.status(400).json({ error: 'Case ID is required' });
    }

    const existing = await db.query.contractorDismissedCases.findFirst({
      where: and(
        eq(contractorDismissedCases.contractorUserId, contractorUserId),
        eq(contractorDismissedCases.caseId, caseId)
      ),
    });

    if (existing) {
      return res.json({ success: true, message: 'Already dismissed' });
    }

    await db.insert(contractorDismissedCases).values({
      contractorUserId,
      caseId,
      reason: reason || null,
    });

    res.json({ success: true, message: 'Request dismissed' });
  } catch (error) {
    console.error('Error dismissing case:', error);
    res.status(500).json({ error: 'Failed to dismiss case' });
  }
});

// Get dismissed/passed cases for this contractor
router.get('/dismissed-cases', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    const dismissed = await db.query.contractorDismissedCases.findMany({
      where: eq(contractorDismissedCases.contractorUserId, contractorUserId),
      with: {
        case: {
          with: {
            property: true,
            unit: true,
            media: true,
          }
        }
      },
      orderBy: (d, { desc }) => [desc(d.dismissedAt)],
    });

    const result = dismissed
      .filter(d => d.case)
      .map(d => ({
        ...d.case,
        dismissedAt: d.dismissedAt,
        dismissId: d.id,
      }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching dismissed cases:', error);
    res.status(500).json({ error: 'Failed to fetch dismissed cases' });
  }
});

// Undo dismiss / restore a passed case
router.delete('/dismiss-case/:caseId', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { caseId } = req.params;

    await db.delete(contractorDismissedCases).where(
      and(
        eq(contractorDismissedCases.contractorUserId, contractorUserId),
        eq(contractorDismissedCases.caseId, caseId)
      )
    );

    res.json({ success: true, message: 'Case restored' });
  } catch (error) {
    console.error('Error restoring case:', error);
    res.status(500).json({ error: 'Failed to restore case' });
  }
});

// Get all customers for this contractor
router.get('/customers', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    const customers = await db.query.contractorCustomers.findMany({
      where: eq(contractorCustomers.contractorId, contractorUserId),
      orderBy: (customers, { desc }) => [desc(customers.createdAt)],
    });
    
    // Get vendor IDs for this contractor (they may work across multiple orgs)
    const contractorVendors = await storage.getContractorVendorsByUserId(contractorUserId);
    const vendorIds = contractorVendors.map(v => v.id);
    
    // Get job counts for each customer
    const customerIds = customers.map(c => c.id);
    let activeJobCounts: { customerId: string; count: number }[] = [];
    let totalJobCounts: { customerId: string; count: number }[] = [];
    
    if (customerIds.length > 0 && vendorIds.length > 0) {
      // Active jobs (not closed/resolved)
      activeJobCounts = await db
        .select({
          customerId: smartCases.customerId,
          count: sql<number>`count(*)::int`.as('count'),
        })
        .from(smartCases)
        .where(
          and(
            inArray(smartCases.customerId, customerIds),
            inArray(smartCases.assignedContractorId, vendorIds),
            sql`${smartCases.status} NOT IN ('Closed', 'Resolved')`
          )
        )
        .groupBy(smartCases.customerId);
      
      // Total jobs (all statuses)
      totalJobCounts = await db
        .select({
          customerId: smartCases.customerId,
          count: sql<number>`count(*)::int`.as('count'),
        })
        .from(smartCases)
        .where(
          and(
            inArray(smartCases.customerId, customerIds),
            inArray(smartCases.assignedContractorId, vendorIds)
          )
        )
        .groupBy(smartCases.customerId);
    }
    
    // Create lookup maps
    const activeJobCountMap = new Map(activeJobCounts.map(ajc => [ajc.customerId, ajc.count]));
    const totalJobCountMap = new Map(totalJobCounts.map(tjc => [tjc.customerId, tjc.count]));
    
    // Add metrics to customers
    const customersWithMetrics = customers.map(customer => ({
      ...customer,
      activeJobCount: activeJobCountMap.get(customer.id) || 0,
      totalJobCount: totalJobCountMap.get(customer.id) || 0,
    }));
    
    res.json(customersWithMetrics);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Quick-add a standalone job (appointment not tied to a case)
router.post('/quick-job', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { title, customerId, scheduledStartAt, scheduledEndAt, address, notes, priority } = req.body;

    if (!title || !scheduledStartAt || !scheduledEndAt) {
      return res.status(400).json({ error: 'Title, start time, and end time are required' });
    }

    const startDate = new Date(scheduledStartAt);
    const endDate = new Date(scheduledEndAt);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    if (customerId) {
      const customer = await db.query.contractorCustomers.findFirst({
        where: and(
          eq(contractorCustomers.id, customerId),
          eq(contractorCustomers.contractorId, contractorUserId)
        ),
      });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    }

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, contractorUserId),
    });

    const contractorId = vendor?.id || contractorUserId;

    const orgLink = await db.query.contractorOrgLinks.findFirst({
      where: eq(contractorOrgLinks.contractorUserId, contractorUserId),
    });

    if (!orgLink) {
      return res.status(400).json({ error: 'No organization linked to this contractor' });
    }

    const [appointment] = await db
      .insert(appointments)
      .values({
        contractorId,
        orgId: orgLink.orgId,
        caseId: null,
        title,
        description: customerId ? `Customer: ${customerId}` : null,
        scheduledStartAt: startDate,
        scheduledEndAt: endDate,
        locationDetails: address || null,
        notes: notes || null,
        priority: priority || 'Medium',
        status: 'Confirmed',
        isEmergency: priority === 'Emergent',
      })
      .returning();

    res.json(appointment);
  } catch (error: any) {
    console.error('Error creating quick job:', error);
    if (error.code === '23P01') {
      return res.status(409).json({ error: 'Time slot conflicts with an existing appointment' });
    }
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Create a new customer
router.post('/customers', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const validatedData = insertContractorCustomerSchema.parse({
      ...req.body,
      contractorId: contractorUserId,
    });
    
    const [newCustomer] = await db
      .insert(contractorCustomers)
      .values(validatedData)
      .returning();
    
    res.json(newCustomer);
  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid customer data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update a customer
router.patch('/customers/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Verify the customer belongs to this contractor
    const existing = await db.query.contractorCustomers.findFirst({
      where: and(
        eq(contractorCustomers.id, id),
        eq(contractorCustomers.contractorId, contractorUserId)
      ),
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const validatedData = insertContractorCustomerSchema.partial().parse(req.body);
    
    const [updatedCustomer] = await db
      .update(contractorCustomers)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(contractorCustomers.id, id))
      .returning();
    
    res.json(updatedCustomer);
  } catch (error: any) {
    console.error('Error updating customer:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid customer data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete a customer
router.delete('/customers/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Verify the customer belongs to this contractor
    const existing = await db.query.contractorCustomers.findFirst({
      where: and(
        eq(contractorCustomers.id, id),
        eq(contractorCustomers.contractorId, contractorUserId)
      ),
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Check if customer has any work orders
    const workOrderCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(smartCases)
      .where(eq(smartCases.customerId, id));
    
    if (workOrderCount[0]?.count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete customer with ${workOrderCount[0].count} existing work order${workOrderCount[0].count > 1 ? 's' : ''}` 
      });
    }
    
    await db
      .delete(contractorCustomers)
      .where(eq(contractorCustomers.id, id));
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    // Check for database foreign key constraint errors
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete customer with existing work orders' });
    }
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// ============================================================================
// QUOTE ROUTES
// ============================================================================

// Get all quotes for contractor
router.get('/quotes', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    const contractorQuotes = await storage.getContractorQuotes(contractorUserId);
    
    const enriched = await Promise.all(contractorQuotes.map(async (quote) => {
      let caseStatus: string | null = null;
      let caseScheduledStartAt: string | null = null;
      
      if (quote.caseId) {
        const caseRecord = await db.query.smartCases.findFirst({
          where: eq(smartCases.id, quote.caseId),
        });
        if (caseRecord) {
          caseStatus = caseRecord.status;
          caseScheduledStartAt = caseRecord.scheduledStartAt?.toISOString() || null;
          
          if (!quote.customerId && caseRecord.reporterUserId) {
            const reporter = await db.query.users.findFirst({
              where: eq(users.id, caseRecord.reporterUserId),
            });
            if (reporter) {
              return {
                ...quote,
                caseStatus,
                caseScheduledStartAt,
                customer: {
                  id: reporter.id,
                  name: [reporter.firstName, reporter.lastName].filter(Boolean).join(' ') || reporter.email || reporter.username || 'Homeowner',
                  email: reporter.email,
                },
                reporterUserId: caseRecord.reporterUserId,
              };
            }
          }
        }
      }
      return { ...quote, caseStatus, caseScheduledStartAt };
    }));
    
    res.json(enriched);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Get single quote with line items
router.get('/quotes/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Use storage to fetch quote with line items
    const quoteData = await storage.getQuoteWithLineItems(id);
    
    if (!quoteData || quoteData.quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    res.json(quoteData);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// Create new quote
router.post('/quotes', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { lineItems, ...quoteData } = req.body;
    
    // Validate customer ownership
    if (quoteData.customerId) {
      const customer = await db.query.contractorCustomers.findFirst({
        where: and(
          eq(contractorCustomers.id, quoteData.customerId),
          eq(contractorCustomers.contractorId, contractorUserId)
        ),
      });
      
      if (!customer) {
        return res.status(403).json({ error: 'Customer not found or access denied' });
      }
    }
    
    // Validate quote data and add approval token
    const validatedQuoteData = insertQuoteSchema.parse({
      ...quoteData,
      contractorId: contractorUserId,
      approvalToken: generateApprovalToken(),
    });
    
    // Create quote using storage
    const newQuote = await storage.createQuote(validatedQuoteData);
    
    // Create line items if provided
    if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
      for (const item of lineItems) {
        const validatedLineItem = insertQuoteLineItemSchema.parse({
          ...item,
          quoteId: newQuote.id,
          displayOrder: item.displayOrder ?? lineItems.indexOf(item),
        });
        await storage.createQuoteLineItem(validatedLineItem);
      }
    }
    
    // Fetch the complete quote using storage
    const completeQuote = await storage.getQuoteWithLineItems(newQuote.id);
    
    res.json(completeQuote);
  } catch (error: any) {
    console.error('Error creating quote:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid quote data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

// Update quote (optionally with line items for atomic updates)
router.patch('/quotes/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    const { lineItems, ...quoteData } = req.body;
    
    // Verify quote ownership using storage
    const existing = await storage.getQuote(id);
    
    if (!existing || existing.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // If updating customerId, verify new customer ownership
    if (quoteData.customerId && quoteData.customerId !== existing.customerId) {
      const customer = await db.query.contractorCustomers.findFirst({
        where: and(
          eq(contractorCustomers.id, quoteData.customerId),
          eq(contractorCustomers.contractorId, contractorUserId)
        ),
      });
      
      if (!customer) {
        return res.status(403).json({ error: 'Customer not found or access denied' });
      }
    }
    
    // Validate quote data - omit immutable fields (contractorId, approvalToken, etc.)
    const quoteUpdateSchema = insertQuoteSchema.partial().omit({ contractorId: true, approvalToken: true });
    const validatedQuoteData = quoteUpdateSchema.parse(quoteData);
    
    // If lineItems are provided, use atomic update
    if (lineItems && Array.isArray(lineItems)) {
      // Validate line items without quoteId/id since we'll inject them in the transaction
      const lineItemUpdateSchema = insertQuoteLineItemSchema.omit({ quoteId: true, id: true });
      const validatedLineItems = lineItems.map((item, index) => 
        lineItemUpdateSchema.parse({
          ...item,
          displayOrder: item.displayOrder ?? index,
        })
      );
      
      const result = await storage.updateQuoteWithLineItems(id, validatedQuoteData, validatedLineItems);
      return res.json(result);
    }
    
    // Otherwise, just update the quote
    const updatedQuote = await storage.updateQuote(id, validatedQuoteData);
    res.json(updatedQuote);
  } catch (error: any) {
    console.error('Error updating quote:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid quote data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

// Delete quote
router.delete('/quotes/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    
    // Verify ownership using storage
    const existing = await storage.getQuote(id);
    
    if (!existing || existing.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Delete using storage (line items will cascade delete)
    await storage.deleteQuote(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

// Send quote (update status to awaiting_response)
router.post('/quotes/:id/send', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { id } = req.params;
    const { method } = req.body; // 'email', 'sms', or 'link'
    
    // Verify ownership using storage
    const quoteData = await storage.getQuoteWithLineItems(id);
    
    if (!quoteData || quoteData.quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const { quote } = quoteData;
    
    // Validate quote can be sent
    if (quote.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft quotes can be sent' });
    }
    
    // Fetch customer details for sending
    const customer = await db.query.contractorCustomers.findFirst({
      where: eq(contractorCustomers.id, quote.customerId),
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Generate approval link
    const approvalLink = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/quote-approval/${quote.id}/${quote.approvalToken}`;
    
    // Update quote status
    await storage.updateQuote(id, {
      status: 'awaiting_response',
      sentVia: method || 'link',
      sentAt: new Date(),
    });
    
    // TODO: Send notification via email/SMS when configured
    console.log(`📧 Quote sent to customer via ${method || 'link'}`);
    console.log(`   Approval link: ${approvalLink}`);
    console.log(`   Customer: ${customer.firstName} ${customer.lastName} (${customer.email || customer.phone || 'no contact'})`);
    
    res.json({ 
      success: true, 
      message: 'Quote sent successfully',
      approvalLink, // Return link for contractor to copy if needed
    });
  } catch (error) {
    console.error('Error sending quote:', error);
    res.status(500).json({ error: 'Failed to send quote' });
  }
});

// Add line item to quote
router.post('/quotes/:quoteId/line-items', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { quoteId } = req.params;
    
    // Verify quote ownership using storage
    const quote = await storage.getQuote(quoteId);
    
    if (!quote || quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const validatedData = insertQuoteLineItemSchema.parse({
      ...req.body,
      quoteId,
    });
    
    // Create using storage
    const newLineItem = await storage.createQuoteLineItem(validatedData);
    
    res.json(newLineItem);
  } catch (error: any) {
    console.error('Error adding line item:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid line item data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to add line item' });
  }
});

// Update line item
router.patch('/quotes/:quoteId/line-items/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { quoteId, id } = req.params;
    
    // Verify quote ownership using storage
    const quote = await storage.getQuote(quoteId);
    
    if (!quote || quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Verify line item belongs to this quote
    const lineItems = await storage.getQuoteLineItems(quoteId);
    const lineItem = lineItems.find(item => item.id === id);
    
    if (!lineItem) {
      return res.status(404).json({ error: 'Line item not found or does not belong to this quote' });
    }
    
    // Explicitly reject attempts to reassign quoteId
    if ('quoteId' in req.body) {
      return res.status(400).json({ error: 'Cannot reassign line item to different quote' });
    }
    
    const validatedData = insertQuoteLineItemSchema.partial().parse(req.body);
    
    // Update using storage
    const updatedLineItem = await storage.updateQuoteLineItem(id, validatedData);
    
    res.json(updatedLineItem);
  } catch (error: any) {
    console.error('Error updating line item:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid line item data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update line item' });
  }
});

// Delete line item
router.delete('/quotes/:quoteId/line-items/:id', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { quoteId, id } = req.params;
    
    // Verify quote ownership using storage
    const quote = await storage.getQuote(quoteId);
    
    if (!quote || quote.contractorId !== contractorUserId) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Verify line item belongs to this quote
    const lineItems = await storage.getQuoteLineItems(quoteId);
    const lineItem = lineItems.find(item => item.id === id);
    
    if (!lineItem) {
      return res.status(404).json({ error: 'Line item not found or does not belong to this quote' });
    }
    
    // Delete using storage
    await storage.deleteQuoteLineItem(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting line item:', error);
    res.status(500).json({ error: 'Failed to delete line item' });
  }
});

// ============================================================================
// COUNTER-PROPOSAL RESPONSE ROUTES
// ============================================================================

// Get pending counter-proposals for contractor's quotes
router.get('/counter-proposals/pending', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    // Get all quotes with pending counter-proposals
    const quotesWithPending = await db.query.quotes.findMany({
      where: and(
        eq(quotes.contractorId, contractorUserId),
        eq(quotes.hasCounterProposal, true),
        eq(quotes.status, 'awaiting_response')
      ),
      with: {
        case: {
          with: {
            property: true,
          },
        },
        counterProposals: {
          where: eq(quoteCounterProposals.status, 'pending'),
          orderBy: (cp, { desc }) => [desc(cp.createdAt)],
          with: {
            proposer: true,
          },
        },
      },
    });
    
    res.json(quotesWithPending);
  } catch (error) {
    console.error('Error fetching pending counter-proposals:', error);
    res.status(500).json({ error: 'Failed to fetch pending counter-proposals' });
  }
});

// Accept a counter-proposal from landlord
router.post('/counter-proposals/:id/accept', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const counterProposalId = req.params.id;
    
    // Get the counter-proposal
    const counterProposal = await db.query.quoteCounterProposals.findFirst({
      where: eq(quoteCounterProposals.id, counterProposalId),
      with: {
        quote: true,
      },
    });
    
    if (!counterProposal) {
      return res.status(404).json({ error: 'Counter-proposal not found' });
    }
    
    // Verify contractor owns the quote
    if (counterProposal.quote.contractorId !== contractorUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update counter-proposal status
    await db.update(quoteCounterProposals)
      .set({
        status: 'accepted',
        respondedAt: new Date(),
        respondedBy: contractorUserId,
      })
      .where(eq(quoteCounterProposals.id, counterProposalId));
    
    // Update quote with accepted terms
    const updateData: any = {
      status: 'sent', // Back to sent status, landlord needs to re-accept
      hasCounterProposal: false,
      updatedAt: new Date(),
    };
    
    // Apply counter-proposal terms if provided
    if (counterProposal.proposedTotal) {
      updateData.total = counterProposal.proposedTotal;
    }
    if (counterProposal.proposedStartDate) {
      updateData.availableStartDate = counterProposal.proposedStartDate;
    }
    if (counterProposal.proposedEndDate) {
      updateData.availableEndDate = counterProposal.proposedEndDate;
    }
    
    await db.update(quotes)
      .set(updateData)
      .where(eq(quotes.id, counterProposal.quoteId));
    
    res.json({ success: true, message: 'Counter-proposal accepted' });
  } catch (error) {
    console.error('Error accepting counter-proposal:', error);
    res.status(500).json({ error: 'Failed to accept counter-proposal' });
  }
});

// Decline a counter-proposal from landlord
router.post('/counter-proposals/:id/decline', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const counterProposalId = req.params.id;
    const { reason } = req.body;
    
    // Get the counter-proposal
    const counterProposal = await db.query.quoteCounterProposals.findFirst({
      where: eq(quoteCounterProposals.id, counterProposalId),
      with: {
        quote: true,
      },
    });
    
    if (!counterProposal) {
      return res.status(404).json({ error: 'Counter-proposal not found' });
    }
    
    // Verify contractor owns the quote
    if (counterProposal.quote.contractorId !== contractorUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update counter-proposal status
    await db.update(quoteCounterProposals)
      .set({
        status: 'rejected',
        respondedAt: new Date(),
        respondedBy: contractorUserId,
        responseMessage: reason,
      })
      .where(eq(quoteCounterProposals.id, counterProposalId));
    
    // Update quote status
    await db.update(quotes)
      .set({
        status: 'sent', // Back to sent, original terms stand
        hasCounterProposal: false,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, counterProposal.quoteId));
    
    res.json({ success: true, message: 'Counter-proposal declined' });
  } catch (error) {
    console.error('Error declining counter-proposal:', error);
    res.status(500).json({ error: 'Failed to decline counter-proposal' });
  }
});

// Re-counter a counter-proposal (contractor makes a new counter)
router.post('/counter-proposals/:id/counter', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const counterProposalId = req.params.id;
    
    // Get the original counter-proposal
    const originalCounterProposal = await db.query.quoteCounterProposals.findFirst({
      where: eq(quoteCounterProposals.id, counterProposalId),
      with: {
        quote: true,
      },
    });
    
    if (!originalCounterProposal) {
      return res.status(404).json({ error: 'Counter-proposal not found' });
    }
    
    // Verify contractor owns the quote
    if (originalCounterProposal.quote.contractorId !== contractorUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Mark original counter-proposal as rejected
    await db.update(quoteCounterProposals)
      .set({
        status: 'rejected',
        respondedAt: new Date(),
        respondedBy: contractorUserId,
        responseMessage: 'Counter-offered with new terms',
      })
      .where(eq(quoteCounterProposals.id, counterProposalId));
    
    // Create a new counter-proposal from contractor
    const validatedData = insertQuoteCounterProposalSchema.parse({
      ...req.body,
      quoteId: originalCounterProposal.quoteId,
      proposedBy: contractorUserId,
      proposedByRole: 'contractor',
    });
    
    const [newCounterProposal] = await db.insert(quoteCounterProposals)
      .values(validatedData)
      .returning();
    
    // Update quote counter count
    await db.update(quotes)
      .set({
        counterProposalCount: (originalCounterProposal.quote.counterProposalCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, originalCounterProposal.quoteId));
    
    res.json({
      success: true,
      counterProposal: newCounterProposal,
      message: 'Counter-proposal sent to landlord',
    });
  } catch (error) {
    console.error('Error creating contractor counter-proposal:', error);
    res.status(500).json({ error: 'Failed to create counter-proposal' });
  }
});

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

// Get all team members (both login-enabled and contact-only)
router.get('/team-members', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const currentUser = req.user!;
    
    // Include the owner (lead contractor) as the first team member
    const ownerMember = {
      id: `owner-${contractorUserId}`,
      memberId: contractorUserId,
      name: [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || currentUser.email || 'Owner',
      email: currentUser.email,
      phone: currentUser.phone,
      role: 'Owner',
      canManageJobs: true,
      hasLogin: true,
      isOwner: true,
      color: generateColorFromId(contractorUserId),
    };
    
    // Get team members with login capability
    const loginMembers = await db.query.contractorTeamMembers.findMany({
      where: and(
        eq(contractorTeamMembers.leadContractorUserId, contractorUserId),
        eq(contractorTeamMembers.isActive, true)
      ),
      with: {
        memberUser: true,
      },
    });
    
    // Get contact-only team members
    const contactMembers = await db.query.contactTeamMembers.findMany({
      where: eq(contactTeamMembers.contractorUserId, contractorUserId),
    });
    
    // Format response
    const formattedLoginMembers = loginMembers.map((m: any) => ({
      id: m.id,
      memberId: m.memberUserId,
      name: [m.memberUser?.firstName, m.memberUser?.lastName].filter(Boolean).join(' ') || m.memberUser?.email || 'Unknown',
      email: m.memberUser?.email,
      phone: m.memberUser?.phone,
      role: m.role,
      canManageJobs: m.canManageJobs,
      hasLogin: true,
      isOwner: false,
      color: generateColorFromId(m.memberUserId),
      joinedAt: m.joinedAt,
    }));
    
    const formattedContactMembers = contactMembers.map((m: any) => ({
      id: m.id,
      memberId: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      role: m.role,
      canManageJobs: false,
      hasLogin: false,
      isOwner: false,
      color: generateColorFromId(m.id),
      notes: m.notes,
    }));
    
    // Get vendor ID for this contractor
    const contractorVendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, contractorUserId),
    });
    
    // Get teams that have scheduled jobs for this contractor
    const teamIdsWithJobs = contractorVendor 
      ? await db.selectDistinct({ teamId: scheduledJobs.teamId })
          .from(scheduledJobs)
          .where(eq(scheduledJobs.contractorId, contractorVendor.id))
      : [];
    const teamIdList = teamIdsWithJobs.map(t => t.teamId).filter((id): id is string => id !== null);
    
    // Get teams from teams table for timeline display
    const contractorTeams = teamIdList.length > 0 
      ? await db.query.teams.findMany({
          where: inArray(teams.id, teamIdList),
        })
      : [];
    
    const formattedTeams = contractorTeams.map((t: any) => ({
      id: t.id,
      memberId: t.id, // Use team ID as memberId for filtering
      name: t.name,
      email: null,
      phone: null,
      role: t.specialty || 'Team',
      canManageJobs: true,
      hasLogin: false,
      isOwner: false,
      isTeam: true,
      color: t.color || generateColorFromId(t.id),
    }));
    
    res.json({
      loginMembers: formattedLoginMembers,
      contactMembers: formattedContactMembers,
      teams: formattedTeams,
      allMembers: [...formattedTeams, ownerMember, ...formattedLoginMembers, ...formattedContactMembers],
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get team calendar - all appointments AND scheduled jobs for contractor and their team
router.get('/team-calendar', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { startDate, endDate } = req.query;
    
    // Get all team member IDs
    const teamMembers = await db.query.contractorTeamMembers.findMany({
      where: and(
        eq(contractorTeamMembers.leadContractorUserId, contractorUserId),
        eq(contractorTeamMembers.isActive, true)
      ),
    });
    
    const teamMemberUserIds = teamMembers.map(m => m.memberUserId);
    const allUserIds = [contractorUserId, ...teamMemberUserIds];
    
    // Get vendor IDs for all team members
    const vendorResults = await db.select().from(vendors).where(
      inArray(vendors.userId, allUserIds)
    );
    const vendorIds = vendorResults.map(v => v.id);
    
    // Combine vendor IDs and user IDs - appointments may use either as contractor_id
    const allContractorIds = [...vendorIds, ...allUserIds];
    
    // Map vendor IDs back to user IDs (for appointments using vendor IDs)
    const vendorToUserMap = new Map(vendorResults.map(v => [v.id, v.userId]));
    
    // Get appointments for all team vendors AND user IDs (legacy appointments use user IDs)
    const allAppointments = await db.query.appointments.findMany({
      where: allContractorIds.length > 0 ? inArray(appointments.contractorId, allContractorIds) : undefined,
      with: {
        smartCase: {
          with: {
            property: true,
          },
        },
      },
      orderBy: (appts, { asc }) => [asc(appts.scheduledStartAt)],
    });
    
    // Get team IDs that have jobs for this contractor
    const teamIdsFromJobs = vendorIds.length > 0 
      ? await db.selectDistinct({ teamId: scheduledJobs.teamId })
          .from(scheduledJobs)
          .where(inArray(scheduledJobs.contractorId, vendorIds))
      : [];
    const teamIds = teamIdsFromJobs.map(t => t.teamId).filter((id): id is string => id !== null);
    
    // Get scheduled jobs by contractor_id OR team_id
    const allScheduledJobs = await db.query.scheduledJobs.findMany({
      where: or(
        vendorIds.length > 0 ? inArray(scheduledJobs.contractorId, vendorIds) : undefined,
        teamIds.length > 0 ? inArray(scheduledJobs.teamId, teamIds) : undefined
      ),
      with: {
        property: true,
      },
      orderBy: (jobs, { asc }) => [asc(jobs.scheduledStartAt)],
    });
    
    // Format appointments
    const formattedAppointments = allAppointments.map((apt: any) => ({
      id: apt.id,
      title: apt.title || apt.smartCase?.title || 'Appointment',
      scheduledStartAt: apt.scheduledStartAt,
      scheduledEndAt: apt.scheduledEndAt,
      status: apt.status,
      contractorId: vendorToUserMap.get(apt.contractorId) || apt.contractorId,
      address: apt.smartCase?.property?.streetAddress 
        ? `${apt.smartCase.property.streetAddress}, ${apt.smartCase.property.city || ''}`
        : null,
      customerName: apt.smartCase?.property?.name,
      urgency: apt.smartCase?.priority || apt.priority || null,
      source: 'appointment',
    }));
    
    // Format scheduled jobs - map status to timeline-compatible status
    const formattedScheduledJobs = allScheduledJobs.map((job: any) => {
      // Map job status to timeline status based on jobStatusEnum values:
      // "Unscheduled", "Scheduled", "Pending Approval", "Needs Review", "Confirmed" → Remaining (blue)
      // "In Progress" → Active (amber)
      // "Completed" → Complete (green)
      // "Cancelled" → hidden/grey
      let timelineStatus = 'Scheduled'; // Default to "Remaining" category
      if (job.status === 'Confirmed') timelineStatus = 'Confirmed';
      else if (job.status === 'In Progress') timelineStatus = 'In Progress';
      else if (job.status === 'Completed') timelineStatus = 'Completed';
      else if (job.status === 'Cancelled') timelineStatus = 'Cancelled';
      
      return {
        id: `job-${job.id}`,
        title: job.title || 'Scheduled Job',
        scheduledStartAt: job.scheduledStartAt,
        scheduledEndAt: job.scheduledEndAt,
        status: timelineStatus,
        contractorId: job.teamId || vendorToUserMap.get(job.contractorId) || job.contractorId, // Use teamId as primary identifier for team-based jobs
        teamId: job.teamId,
        address: job.address || (job.property?.streetAddress 
          ? `${job.property.streetAddress}, ${job.property.city || ''}`
          : null),
        customerName: job.property?.name,
        urgency: job.urgency || null,
        source: 'scheduled_job',
      };
    });
    
    // Combine and sort by start time
    const combined = [...formattedAppointments, ...formattedScheduledJobs]
      .filter(item => item.scheduledStartAt)
      .sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime());
    
    res.json(combined);
  } catch (error) {
    console.error('Error fetching team calendar:', error);
    res.status(500).json({ error: 'Failed to fetch team calendar' });
  }
});

// Get customers with geocoded locations for map view
router.get('/customers-map', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    const customers = await db.query.contractorCustomers.findMany({
      where: and(
        eq(contractorCustomers.contractorId, contractorUserId),
        isNotNull(contractorCustomers.latitude),
        isNotNull(contractorCustomers.longitude)
      ),
    });
    
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers for map:', error);
    res.status(500).json({ error: 'Failed to fetch customer locations' });
  }
});

// Geocode a customer address (using free Nominatim API)
router.post('/customers/:customerId/geocode', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    const { customerId } = req.params;
    
    // Verify ownership
    const customer = await db.query.contractorCustomers.findFirst({
      where: and(
        eq(contractorCustomers.id, customerId),
        eq(contractorCustomers.contractorId, contractorUserId)
      ),
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Build address string
    const addressParts = [
      customer.streetAddress,
      customer.city,
      customer.state,
      customer.zipCode,
    ].filter(Boolean);
    
    if (addressParts.length === 0) {
      return res.status(400).json({ error: 'No address to geocode' });
    }
    
    const address = addressParts.join(', ');
    
    // Call Nominatim API (free OpenStreetMap geocoding)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'AllAI-Property-Management/1.0',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }
    
    const results = await response.json();
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }
    
    // Parse and validate lat/lon as numbers
    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);
    
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates returned' });
    }
    
    // Update customer with coordinates (stored as decimal strings)
    const [updated] = await db.update(contractorCustomers)
      .set({
        latitude: String(lat),
        longitude: String(lon),
        geocodedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contractorCustomers.id, customerId))
      .returning();
    
    res.json({
      success: true,
      latitude: lat,
      longitude: lon,
      customer: updated,
    });
  } catch (error) {
    console.error('Error geocoding customer:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// Batch geocode all customers without coordinates (limited to 5 at a time)
router.post('/customers/geocode-all', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    // Get customers without coordinates but with addresses - limit to 5 per batch
    const customersToGeocode = await db.select().from(contractorCustomers).where(
      and(
        eq(contractorCustomers.contractorId, contractorUserId),
        sql`${contractorCustomers.latitude} IS NULL`,
        sql`${contractorCustomers.streetAddress} IS NOT NULL`
      )
    ).limit(5);
    
    const results = {
      total: customersToGeocode.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
      remaining: 0,
    };
    
    // Count remaining for user feedback
    const [countResult] = await db.select({ count: sql`count(*)` }).from(contractorCustomers).where(
      and(
        eq(contractorCustomers.contractorId, contractorUserId),
        sql`${contractorCustomers.latitude} IS NULL`,
        sql`${contractorCustomers.streetAddress} IS NOT NULL`
      )
    );
    results.remaining = Math.max(0, Number(countResult?.count || 0) - 5);
    
    // Rate limit: 1 request per second for Nominatim
    for (const customer of customersToGeocode) {
      try {
        const addressParts = [
          customer.streetAddress,
          customer.city,
          customer.state,
          customer.zipCode,
        ].filter(Boolean);
        
        if (addressParts.length === 0) continue;
        
        const address = addressParts.join(', ');
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
          {
            headers: {
              'User-Agent': 'AllAI-Property-Management/1.0',
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            // Parse and validate lat/lon as numbers
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            
            if (!isNaN(lat) && !isNaN(lon)) {
              await db.update(contractorCustomers)
                .set({
                  latitude: String(lat),
                  longitude: String(lon),
                  geocodedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(contractorCustomers.id, customer.id));
              results.success++;
            } else {
              results.failed++;
              results.errors.push(`${customer.id}: Invalid coordinates`);
            }
          } else {
            results.failed++;
            results.errors.push(`${customer.id}: Address not found`);
          }
        } else {
          results.failed++;
        }
        
        // Wait 1.1 seconds between requests (Nominatim rate limit with buffer)
        await new Promise(resolve => setTimeout(resolve, 1100));
      } catch (err) {
        results.failed++;
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error batch geocoding customers:', error);
    res.status(500).json({ error: 'Failed to geocode customers' });
  }
});

// Get historical dashboard metrics for sparkline graphs (last 7 days)
router.get('/dashboard-metrics', requireAuth, requireRole('contractor'), async (req: AuthenticatedRequest, res) => {
  try {
    const contractorUserId = req.user!.id;
    
    // Get contractor's vendor ID for quote queries
    const vendorRecord = await db.query.vendors.findFirst({
      where: eq(vendors.userId, contractorUserId),
    });
    
    const vendorId = vendorRecord?.id;
    
    // Calculate date range for last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Include today + 6 previous days
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    // Query smart_cases (requests) assigned to this contractor, grouped by day
    const requestsData = await db.execute(sql`
      SELECT 
        DATE(created_at) as day,
        COUNT(*) as count,
        SUM(CASE WHEN status IN ('Resolved', 'Closed', 'In Progress') THEN 1 ELSE 0 END) as converted
      FROM smart_cases 
      WHERE assigned_contractor_id = ${contractorUserId}
        AND created_at >= ${sevenDaysAgo.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `);
    
    // Query quotes by this contractor, grouped by day
    const quotesData = vendorId ? await db.execute(sql`
      SELECT 
        DATE(created_at) as day,
        COUNT(*) as sent,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
      FROM quotes 
      WHERE contractor_id = ${vendorId}
        AND created_at >= ${sevenDaysAgo.toISOString()}
        AND archived_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `) : { rows: [] };
    
    // Query scheduled_jobs for this contractor, grouped by day (job_status enum: Completed is valid)
    const jobsData = await db.execute(sql`
      SELECT 
        DATE(created_at) as day,
        COUNT(*) as started,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed
      FROM scheduled_jobs 
      WHERE contractor_id = ${contractorUserId}
        AND created_at >= ${sevenDaysAgo.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `);
    
    // Build arrays for each day (fill in zeros for missing days)
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    
    // Map database results to daily arrays
    const requestsMap = new Map((requestsData.rows as any[]).map(r => [r.day, r]));
    const quotesMap = new Map((quotesData.rows as any[]).map(r => [r.day, r]));
    const jobsMap = new Map((jobsData.rows as any[]).map(r => [r.day, r]));
    
    const metrics = {
      requests: {
        received: days.map(d => Number(requestsMap.get(d)?.count || 0)),
        converted: days.map(d => Number(requestsMap.get(d)?.converted || 0)),
      },
      quotes: {
        sent: days.map(d => Number(quotesMap.get(d)?.sent || 0)),
        approved: days.map(d => Number(quotesMap.get(d)?.approved || 0)),
      },
      jobs: {
        started: days.map(d => Number(jobsMap.get(d)?.started || 0)),
        completed: days.map(d => Number(jobsMap.get(d)?.completed || 0)),
      },
      invoices: {
        // Simulated data until invoices table exists - varied patterns for visual distinction
        sent: days.map((_, i) => [4, 7, 3, 9, 5, 11, 6][i] || 0),
        paid: days.map((_, i) => [1, 3, 1, 4, 2, 5, 2][i] || 0),
      },
      days,
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// Helper function to generate consistent colors from IDs
function generateColorFromId(id: string): string {
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#8B5CF6', // Purple
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#EC4899', // Pink
    '#84CC16', // Lime
  ];
  
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export default router;
