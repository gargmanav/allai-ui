import { Router } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { properties, smartCases, tenants, ownershipEntities, units, transactions, quotes, quoteLineItems, quoteCounterProposals, users, insertQuoteCounterProposalSchema, vendors, contractorProfiles, contractorOrgLinks, favoriteContractors, userContractorSpecialties, contractorSpecialties, approvalPolicies } from '@shared/schema';
import { eq, and, ne, gte, desc, count, isNull, inArray, sql } from 'drizzle-orm';

const router = Router();

// Get landlord's properties
router.get('/properties', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const props = await db.query.properties.findMany({
      where: eq(properties.orgId, orgId),
      with: {
        units: true,
      },
      orderBy: (props, { desc }) => [desc(props.createdAt)],
    });

    const propsWithCounts = props.map(prop => ({
      ...prop,
      _count: {
        units: prop.units?.length || 0,
      },
    }));

    res.json(propsWithCounts);
  } catch (error) {
    console.error('Error fetching landlord properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get landlord's cases
router.get('/cases', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const cases = await db.query.smartCases.findMany({
      where: eq(smartCases.orgId, orgId),
      with: {
        property: true,
        unit: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
      limit: 50,
    });

    res.json(cases);
  } catch (error) {
    console.error('Error fetching landlord cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Get landlord's tenants
router.get('/tenants', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const orgTenants = await db.query.tenants.findMany({
      where: eq(tenants.orgId, orgId),
      with: {
        user: true,
        unit: {
          with: {
            property: true,
          },
        },
      },
      orderBy: (tenants, { desc }) => [desc(tenants.createdAt)],
    });

    res.json(orgTenants);
  } catch (error) {
    console.error('Error fetching landlord tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get landlord's ownership entities
router.get('/entities', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const entities = await db.query.ownershipEntities.findMany({
      where: eq(ownershipEntities.orgId, orgId),
      orderBy: (entities, { asc }) => [asc(entities.name)],
    });

    res.json(entities);
  } catch (error) {
    console.error('Error fetching entities:', error);
    res.status(500).json({ error: 'Failed to fetch entities' });
  }
});

// Get landlord's units  
router.get('/units', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    const orgUnits = await db.query.units.findMany({
      where: eq(units.orgId, orgId),
      with: {
        property: true,
      },
      orderBy: [desc(units.createdAt)],
    });

    res.json(orgUnits);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Count properties
    const [propertyCount] = await db.select({ count: count() })
      .from(properties)
      .where(eq(properties.orgId, orgId));
    
    // Count open cases
    const [caseCount] = await db.select({ count: count() })
      .from(smartCases)
      .where(and(
        eq(smartCases.orgId, orgId),
        ne(smartCases.status, 'Resolved'),
        ne(smartCases.status, 'Closed')
      ));

    res.json({
      totalProperties: propertyCount.count || 0,
      monthlyRevenue: 0,  // Stub - revenue calculation would need transactions aggregation
      openCases: caseCount.count || 0,
      dueReminders: 0,  // Stub - would need reminders table join
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get rent collection status (stub for now)
router.get('/dashboard/rent-collection', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Stub response - would need proper rent tracking logic
    res.json({
      collected: 0,
      pending: 0,
      overdue: 0,
    });
  } catch (error) {
    console.error('Error fetching rent collection:', error);
    res.status(500).json({ error: 'Failed to fetch rent collection' });
  }
});

// Get predictive insights (stub for now)
router.get('/predictive-insights', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Return empty array - predictive insights disabled
    res.json([]);
  } catch (error) {
    console.error('Error fetching predictive insights:', error);
    res.status(500).json({ error: 'Failed to fetch predictive insights' });
  }
});

// ============================================================================
// QUOTE/PROPOSAL COMPARISON SYSTEM
// ============================================================================

// Get all quotes for a work order (for landlord comparison view)
router.get('/cases/:caseId/quotes', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const caseId = req.params.caseId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Verify the case belongs to this org
    const smartCase = await db.query.smartCases.findFirst({
      where: and(eq(smartCases.id, caseId), eq(smartCases.orgId, orgId)),
    });
    
    if (!smartCase) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    // Get all quotes for this case with contractor info and line items
    const caseQuotes = await db.query.quotes.findMany({
      where: and(
        eq(quotes.caseId, caseId),
        isNull(quotes.archivedAt)
      ),
      with: {
        contractor: true,
        lineItems: true,
        counterProposals: {
          orderBy: (cp, { desc }) => [desc(cp.createdAt)],
        },
      },
      orderBy: (q, { desc }) => [desc(q.createdAt)],
    });
    
    // Format the quotes with contractor details
    const formattedQuotes = caseQuotes.map(quote => ({
      id: quote.id,
      contractor: {
        id: quote.contractor?.id,
        firstName: quote.contractor?.firstName,
        lastName: quote.contractor?.lastName,
        email: quote.contractor?.email,
        phone: quote.contractor?.phone,
      },
      title: quote.title,
      status: quote.status,
      total: parseFloat(quote.total || '0'),
      subtotal: parseFloat(quote.subtotal || '0'),
      taxAmount: parseFloat(quote.taxAmount || '0'),
      depositRequired: parseFloat(quote.requiredDepositAmount || '0'),
      availableStartDate: quote.availableStartDate,
      availableEndDate: quote.availableEndDate,
      estimatedDays: quote.estimatedDays,
      scopeOfWork: quote.scopeOfWork,
      clientMessage: quote.clientMessage,
      lineItems: quote.lineItems.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: parseFloat(item.quantity || '0'),
        unitPrice: parseFloat(item.unitPrice || '0'),
        total: parseFloat(item.total || '0'),
      })),
      hasCounterProposal: quote.hasCounterProposal,
      counterProposalCount: quote.counterProposalCount,
      latestCounterProposal: quote.counterProposals?.[0] || null,
      createdAt: quote.createdAt,
      expiresAt: quote.expiresAt,
    }));
    
    res.json({
      caseId,
      caseTitle: smartCase.title,
      caseStatus: smartCase.status,
      quotes: formattedQuotes,
    });
  } catch (error) {
    console.error('Error fetching case quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Accept a quote
router.post('/quotes/:quoteId/accept', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const quoteId = req.params.quoteId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Get the quote and verify access
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, quoteId),
      with: { case: true },
    });
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Verify case belongs to this org
    if (!quote.case || quote.case.orgId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update the quote status to approved
    await db.update(quotes)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));
    
    // Decline all other quotes for this case
    if (quote.caseId) {
      await db.update(quotes)
        .set({
          status: 'declined',
          declinedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(quotes.caseId, quote.caseId),
          ne(quotes.id, quoteId),
          isNull(quotes.archivedAt)
        ));
      
      // Update case status to In Review (awaiting contractor confirmation)
      await db.update(smartCases)
        .set({
          status: 'In Review',
          assignedContractorId: quote.contractorId,
          updatedAt: new Date(),
        })
        .where(eq(smartCases.id, quote.caseId));
    }
    
    res.json({ success: true, message: 'Quote accepted' });
  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({ error: 'Failed to accept quote' });
  }
});

// Decline a quote
router.post('/quotes/:quoteId/decline', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const quoteId = req.params.quoteId;
    const { reason } = req.body;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Get the quote and verify access
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, quoteId),
      with: { case: true },
    });
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Verify case belongs to this org
    if (!quote.case || quote.case.orgId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update the quote status to declined
    await db.update(quotes)
      .set({
        status: 'declined',
        declinedAt: new Date(),
        internalNotes: reason ? `Declined: ${reason}` : quote.internalNotes,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));
    
    res.json({ success: true, message: 'Quote declined' });
  } catch (error) {
    console.error('Error declining quote:', error);
    res.status(500).json({ error: 'Failed to decline quote' });
  }
});

// Counter-propose a quote
router.post('/quotes/:quoteId/counter', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const quoteId = req.params.quoteId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Validate input
    const validatedData = insertQuoteCounterProposalSchema.parse({
      ...req.body,
      quoteId,
      proposedBy: userId,
      proposedByRole: 'landlord',
    });
    
    // Get the quote and verify access
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, quoteId),
      with: { case: true },
    });
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Verify case belongs to this org
    if (!quote.case || quote.case.orgId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Create the counter-proposal
    const [counterProposal] = await db.insert(quoteCounterProposals)
      .values(validatedData)
      .returning();
    
    // Update the quote to indicate it has a counter-proposal
    await db.update(quotes)
      .set({
        status: 'awaiting_response',
        hasCounterProposal: true,
        counterProposalCount: (quote.counterProposalCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));
    
    res.json({
      success: true,
      counterProposal,
      message: 'Counter-proposal sent to contractor',
    });
  } catch (error) {
    console.error('Error creating counter-proposal:', error);
    res.status(500).json({ error: 'Failed to create counter-proposal' });
  }
});

// Get all quotes with pending counter-proposals (landlord notification view)
router.get('/quotes/pending-responses', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    
    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }
    
    // Get quotes with pending counter-proposals for this org's cases
    const pendingQuotes = await db.query.quotes.findMany({
      where: and(
        eq(quotes.orgId, orgId),
        eq(quotes.hasCounterProposal, true),
        eq(quotes.status, 'awaiting_response'),
        isNull(quotes.archivedAt)
      ),
      with: {
        contractor: true,
        case: true,
        counterProposals: {
          where: eq(quoteCounterProposals.status, 'pending'),
          orderBy: (cp, { desc }) => [desc(cp.createdAt)],
          limit: 1,
        },
      },
    });
    
    res.json(pendingQuotes);
  } catch (error) {
    console.error('Error fetching pending responses:', error);
    res.status(500).json({ error: 'Failed to fetch pending responses' });
  }
});

// ============================================================================
// MAYA RECOMMENDATIONS & CASE ACTIONS
// ============================================================================

router.get('/maya/recommendations/:caseId', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const caseId = req.params.caseId;

    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }

    const smartCase = await db.query.smartCases.findFirst({
      where: and(eq(smartCases.id, caseId), eq(smartCases.orgId, orgId)),
    });

    if (!smartCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const policy = await db.query.approvalPolicies.findFirst({
      where: and(eq(approvalPolicies.orgId, orgId), eq(approvalPolicies.isActive, true)),
    });

    const involvementMode = policy?.involvementMode || 'hands-on';
    const trustedIds: string[] = (policy?.trustedContractorIds as string[]) || [];
    const autoApproveCostLimit = policy?.autoApproveCostLimit || null;

    const favs = await db.select({ contractorUserId: favoriteContractors.contractorUserId })
      .from(favoriteContractors)
      .where(eq(favoriteContractors.orgId, orgId));
    const favoriteUserIds = favs.map(f => f.contractorUserId);

    const orgVendors = await db.select().from(vendors).where(eq(vendors.orgId, orgId));

    const vendorUserIds = orgVendors.filter(v => v.userId).map(v => v.userId!);

    let profiles: any[] = [];
    let specialtiesMap: Record<string, string[]> = {};
    let orgLinksMap: Record<string, any> = {};

    if (vendorUserIds.length > 0) {
      profiles = await db.select().from(contractorProfiles).where(inArray(contractorProfiles.userId, vendorUserIds));

      const userSpecs = await db.select({
        userId: userContractorSpecialties.userId,
        name: contractorSpecialties.name,
      })
        .from(userContractorSpecialties)
        .innerJoin(contractorSpecialties, eq(userContractorSpecialties.specialtyId, contractorSpecialties.id))
        .where(inArray(userContractorSpecialties.userId, vendorUserIds));

      for (const s of userSpecs) {
        if (!specialtiesMap[s.userId]) specialtiesMap[s.userId] = [];
        specialtiesMap[s.userId].push(s.name);
      }

      const orgLinks = await db.select().from(contractorOrgLinks)
        .where(and(
          inArray(contractorOrgLinks.contractorUserId, vendorUserIds),
          eq(contractorOrgLinks.orgId, orgId)
        ));
      for (const link of orgLinks) {
        orgLinksMap[link.contractorUserId] = link;
      }
    }

    const profilesMap: Record<string, any> = {};
    for (const p of profiles) {
      profilesMap[p.userId] = p;
    }

    const caseCategory = smartCase.category?.toLowerCase() || '';

    const scored = orgVendors.map(vendor => {
      const isTrusted = trustedIds.includes(vendor.id);
      const isFavorite = vendor.userId ? favoriteUserIds.includes(vendor.userId) : false;
      const profile = vendor.userId ? profilesMap[vendor.userId] : null;
      const vendorSpecialties = vendor.userId ? (specialtiesMap[vendor.userId] || []) : [];
      const isAvailable = profile?.isAvailable ?? true;
      const categoryMatch = caseCategory && vendor.category?.toLowerCase().includes(caseCategory);

      let score = 0;
      if (involvementMode === 'hands-on') {
        if (categoryMatch) score += 60;
        if (isAvailable) score += 40;
        if (isTrusted) score += 50;
        if (isFavorite) score += 30;
      } else if (involvementMode === 'balanced') {
        if (isTrusted) score += 100;
        if (isFavorite) score += 50;
        if (categoryMatch) score += 30;
        if (isAvailable) score += 20;
      } else {
        if (isTrusted) score += 200;
        if (isFavorite) score += 150;
        if (categoryMatch) score += 30;
        if (isAvailable) score += 20;
      }

      if (vendor.isPreferred) score += 10;

      let mayaNote = '';
      if (isTrusted && isFavorite) mayaNote = 'Trusted & favorite contractor';
      else if (isTrusted) mayaNote = 'Trusted contractor per your policy';
      else if (isFavorite) mayaNote = 'One of your favorite contractors';
      else if (categoryMatch) mayaNote = `Specializes in ${vendor.category}`;
      else if (isAvailable) mayaNote = 'Currently available';

      return {
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        rating: vendor.rating ? parseFloat(vendor.rating) : null,
        responseTimeHours: profile?.responseTimeHours ?? vendor.responseTimeHours ?? 24,
        emergencyAvailable: profile?.emergencyAvailable ?? vendor.emergencyAvailable ?? false,
        isPreferred: vendor.isPreferred || false,
        isTrusted,
        isFavorite,
        specialties: vendorSpecialties,
        mayaNote,
        score,
      };
    });

    let filtered = scored;
    if (involvementMode === 'hands-off') {
      const trustedOrFav = scored.filter(c => c.isTrusted || c.isFavorite);
      if (trustedOrFav.length > 0) {
        filtered = trustedOrFav;
      }
    }

    filtered.sort((a, b) => b.score - a.score);
    const top3 = filtered.slice(0, 3).map(({ score, ...rest }) => rest);

    res.json({
      contractors: top3,
      involvementMode,
      autoApproveCostLimit,
    });
  } catch (error) {
    console.error('Error fetching Maya recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

router.post('/cases/:caseId/assign', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const caseId = req.params.caseId;
    const { vendorId, note } = req.body;

    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }

    if (!vendorId) {
      return res.status(400).json({ error: 'vendorId is required' });
    }

    const smartCase = await db.query.smartCases.findFirst({
      where: and(eq(smartCases.id, caseId), eq(smartCases.orgId, orgId)),
    });

    if (!smartCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (smartCase.status !== 'New' && smartCase.assignedContractorId) {
      return res.status(400).json({ error: 'Case is already assigned' });
    }

    const vendor = await db.query.vendors.findFirst({
      where: and(eq(vendors.id, vendorId), eq(vendors.orgId, orgId)),
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found in this organization' });
    }

    const [updated] = await db.update(smartCases)
      .set({
        assignedContractorId: vendorId,
        status: 'In Review',
        updatedAt: new Date(),
      })
      .where(eq(smartCases.id, caseId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error assigning contractor:', error);
    res.status(500).json({ error: 'Failed to assign contractor' });
  }
});

router.post('/cases/:caseId/priority', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const caseId = req.params.caseId;
    const { priority } = req.body;

    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }

    if (!priority || !['Normal', 'High', 'Urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority. Must be Normal, High, or Urgent' });
    }

    const smartCase = await db.query.smartCases.findFirst({
      where: and(eq(smartCases.id, caseId), eq(smartCases.orgId, orgId)),
    });

    if (!smartCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [updated] = await db.update(smartCases)
      .set({
        priority,
        updatedAt: new Date(),
      })
      .where(eq(smartCases.id, caseId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

router.post('/cases/:caseId/close', requireAuth, requireRole('org_admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.user!.orgId;
    const caseId = req.params.caseId;

    if (!orgId) {
      return res.status(403).json({ error: 'No organization access' });
    }

    const smartCase = await db.query.smartCases.findFirst({
      where: and(eq(smartCases.id, caseId), eq(smartCases.orgId, orgId)),
    });

    if (!smartCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [updated] = await db.update(smartCases)
      .set({
        status: 'Resolved',
        updatedAt: new Date(),
      })
      .where(eq(smartCases.id, caseId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error closing case:', error);
    res.status(500).json({ error: 'Failed to close case' });
  }
});

export default router;
