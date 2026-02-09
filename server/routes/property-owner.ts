import { Router } from 'express';
import multer from 'multer';
import { db } from '../db';
import { properties, smartCases, organizationMembers, favoriteContractors, vendors, users, quotes, quoteLineItems, caseMedia, caseEvents, contractorDismissedCases } from '@shared/schema';
import { eq, and, or, desc, ne, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { aiTriageService } from '../aiTriage';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  },
});

const router = Router();

// Helper to get user ID from session
const getUserId = (req: any): string => {
  return req.user?.claims?.sub || req.session?.userId;
};

// Middleware to verify property_owner role
router.use(async (req: any, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user || user.primaryRole !== 'property_owner') {
      return res.status(403).json({ error: 'Property owner access required' });
    }
    
    next();
  } catch (error) {
    console.error('Property owner auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/properties', async (req: any, res) => {
  try {
    const userId = getUserId(req);

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const userProperties = await db.query.properties.findMany({
      where: eq(properties.orgId, membership.orgId),
      with: {
        organization: true,
      },
      orderBy: [desc(properties.createdAt)],
    });

    res.json(userProperties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.post('/properties', async (req: any, res) => {
  try {
    const userId = getUserId(req);

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const propertyData = {
      ...req.body,
      orgId: membership.orgId,
    };

    const [property] = await db.insert(properties).values(propertyData).returning();

    res.json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

router.get('/cases', async (req: any, res) => {
  try {
    const userId = getUserId(req);

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const userProperties = await db.query.properties.findMany({
      where: eq(properties.orgId, membership.orgId),
    });

    const propertyIds = userProperties.map(p => p.id);

    const ownershipConditions = [
      eq(smartCases.reporterUserId, userId),
    ];
    if (propertyIds.length > 0) {
      ownershipConditions.push(...propertyIds.map(id => eq(smartCases.propertyId, id)));
    }

    const cases = await db.query.smartCases.findMany({
      where: and(
        eq(smartCases.orgId, membership.orgId),
        or(...ownershipConditions)
      ),
      with: {
        property: true,
      },
      orderBy: [desc(smartCases.createdAt)],
    });

    res.json(cases);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Create a new case/request from homeowner
router.post('/cases', async (req: any, res) => {
  try {
    const userId = getUserId(req);

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const createCaseSchema = z.object({
      title: z.string().max(200).optional(),
      description: z.string().max(5000).optional(),
      category: z.string().max(100).optional(),
      priority: z.string().max(50).optional(),
      aiTriageJson: z.any().optional(),
    }).refine(data => data.title || data.description, {
      message: 'Title or description is required',
    });

    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid data' });
    }

    const { title, description, category, aiTriageJson, priority } = parsed.data;

    const priorityMap: Record<string, string> = {
      'Critical': 'Urgent', 'critical': 'Urgent', 'emergency': 'Urgent',
      'High': 'High', 'high': 'High', 'urgent': 'Urgent',
      'Medium': 'Normal', 'medium': 'Normal',
      'Low': 'Normal', 'low': 'Normal',
    };
    const mappedPriority = priority ? (priorityMap[priority] || 'Normal') : 'Normal';

    const caseId = uuidv4();
    const [newCase] = await db.insert(smartCases).values({
      id: caseId,
      orgId: membership.orgId,
      reporterUserId: userId,
      title: title || (description ? description.slice(0, 80) : 'New Request'),
      description: description || '',
      category: category || null,
      priority: mappedPriority as any,
      status: 'New',
      aiTriageJson: aiTriageJson || null,
      postedAt: new Date(),
    }).returning();

    res.status(201).json(newCase);
  } catch (error) {
    console.error('Error creating case:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// Get quotes for a specific case
router.get('/cases/:caseId/quotes', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { caseId } = req.params;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify the case belongs to this org
    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.orgId, membership.orgId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Get all quotes for this case with line items
    const caseQuotes = await db.query.quotes.findMany({
      where: and(
        eq(quotes.caseId, caseId),
        isNull(quotes.archivedAt)
      ),
      with: {
        lineItems: true,
      },
      orderBy: [desc(quotes.createdAt)],
    });

    // Enrich quotes with contractor info
    const enrichedQuotes = await Promise.all(caseQuotes.map(async (quote) => {
      const contractor = await db.query.users.findFirst({
        where: eq(users.id, quote.contractorId),
      });
      return {
        ...quote,
        contractorName: contractor ? `${contractor.firstName} ${contractor.lastName}`.trim() : 'Unknown Contractor',
        contractorFirstName: contractor?.firstName || 'Unknown',
        contractorEmail: contractor?.email || '',
      };
    }));

    res.json(enrichedQuotes);
  } catch (error) {
    console.error('Error fetching case quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Accept a quote for a case
router.post('/cases/:caseId/quotes/:quoteId/accept', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { caseId, quoteId } = req.params;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Verify the case belongs to this user in this org
    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.orgId, membership.orgId),
        eq(smartCases.reporterUserId, userId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Get the quote
    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, quoteId),
        eq(quotes.caseId, caseId)
      ),
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Accept this quote
    await db.update(quotes)
      .set({ status: 'approved', approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, quoteId));

    // Decline all other quotes for this case
    const otherQuotes = await db.query.quotes.findMany({
      where: and(
        eq(quotes.caseId, caseId),
        isNull(quotes.archivedAt)
      ),
    });
    for (const otherQuote of otherQuotes) {
      if (otherQuote.id !== quoteId) {
        await db.update(quotes)
          .set({ status: 'declined', declinedAt: new Date(), updatedAt: new Date() })
          .where(eq(quotes.id, otherQuote.id));
      }
    }

    // Assign contractor to the case - set to "In Review" awaiting contractor confirmation
    await db.update(smartCases)
      .set({ 
        assignedContractorId: quote.contractorId, 
        status: 'In Review',
        estimatedCost: quote.total ? String(quote.total) : null,
        updatedAt: new Date() 
      })
      .where(eq(smartCases.id, caseId));

    res.json({ success: true, message: 'Quote accepted - awaiting contractor confirmation' });
  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({ error: 'Failed to accept quote' });
  }
});

// Decline a quote
router.post('/cases/:caseId/quotes/:quoteId/decline', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { caseId, quoteId } = req.params;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.orgId, membership.orgId),
        eq(smartCases.reporterUserId, userId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    await db.update(quotes)
      .set({ status: 'declined', declinedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(quotes.id, quoteId), eq(quotes.caseId, caseId)));

    res.json({ success: true, message: 'Quote declined' });
  } catch (error) {
    console.error('Error declining quote:', error);
    res.status(500).json({ error: 'Failed to decline quote' });
  }
});

// Cancel an accepted quote - reverts to open bidding
router.post('/cases/:caseId/quotes/:quoteId/cancel', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { caseId, quoteId } = req.params;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.orgId, membership.orgId),
        eq(smartCases.reporterUserId, userId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const quote = await db.query.quotes.findFirst({
      where: and(eq(quotes.id, quoteId), eq(quotes.caseId, caseId)),
    });

    if (!quote || quote.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved quotes can be cancelled' });
    }

    // Mark this quote as cancelled
    await db.update(quotes)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(quotes.id, quoteId));

    // Revert previously auto-declined quotes back to sent so homeowner can re-evaluate
    await db.update(quotes)
      .set({ status: 'sent', declinedAt: null, updatedAt: new Date() })
      .where(and(
        eq(quotes.caseId, caseId),
        ne(quotes.id, quoteId),
        isNull(quotes.archivedAt)
      ));

    // Reset case status back to open
    await db.update(smartCases)
      .set({
        status: 'New',
        assignedContractorId: null,
        updatedAt: new Date(),
      })
      .where(eq(smartCases.id, caseId));

    res.json({ success: true, message: 'Acceptance cancelled' });
  } catch (error) {
    console.error('Error cancelling quote acceptance:', error);
    res.status(500).json({ error: 'Failed to cancel acceptance' });
  }
});

router.post('/cases/:caseId/photos', upload.array('photos', 5), async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { caseId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.orgId, membership.orgId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const mediaRecords = await Promise.all(files.map(async (file) => {
      const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const [record] = await db.insert(caseMedia).values({
        caseId,
        url: base64,
        type: 'image',
      }).returning();
      return record;
    }));

    res.json({ success: true, photos: mediaRecords });

    const photoUrls = mediaRecords.map(r => r.url);
    aiTriageService.generatePhotoAnalysis(
      photoUrls,
      caseRecord.title,
      caseRecord.description || ''
    ).then(async (photoAnalysis) => {
      if (photoAnalysis) {
        try {
          const existingTriage = (caseRecord as any).aiTriageJson || {};
          await db.update(smartCases)
            .set({
              aiTriageJson: { ...existingTriage, photoAnalysis },
            })
            .where(eq(smartCases.id, caseId));
          console.log(`🤖 Photo analysis saved for case ${caseId}`);
        } catch (err) {
          console.error('Failed to save photo analysis:', err);
        }
      }
    }).catch(err => {
      console.error('Photo analysis background task failed:', err);
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

router.get('/cases/:caseId/photos', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { caseId } = req.params;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.orgId, membership.orgId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const photos = await db.query.caseMedia.findMany({
      where: and(
        eq(caseMedia.caseId, caseId),
        eq(caseMedia.type, 'image')
      ),
    });

    res.json(photos);
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

router.patch('/cases/:caseId', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { caseId } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.orgId, membership.orgId),
        eq(smartCases.reporterUserId, userId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [updated] = await db.update(smartCases)
      .set({ title: title.trim() })
      .where(eq(smartCases.id, caseId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error renaming case:', error);
    res.status(500).json({ error: 'Failed to rename case' });
  }
});

router.delete('/cases/:caseId', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { caseId } = req.params;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.orgId, membership.orgId),
        eq(smartCases.reporterUserId, userId)
      ),
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const activeStatuses = ["In Review", "Scheduled", "In Progress", "On Hold"];
    if (activeStatuses.includes(caseRecord.status || "")) {
      return res.status(400).json({ 
        error: 'Cannot delete a request that has active work in progress. Cancel the work first.' 
      });
    }

    const activeQuotes = await db.query.quotes.findMany({
      where: and(
        eq(quotes.caseId, caseId),
        isNull(quotes.archivedAt)
      ),
    });

    const hasActiveQuote = activeQuotes.some(q => ['approved', 'accepted', 'in_progress'].includes(q.status || ''));
    if (hasActiveQuote) {
      return res.status(400).json({ 
        error: 'Cannot delete a request with an accepted quote. Cancel the work first.' 
      });
    }

    const quoteIds = activeQuotes.map(q => q.id);
    if (quoteIds.length > 0) {
      await db.delete(quoteLineItems).where(inArray(quoteLineItems.quoteId, quoteIds));
      await db.delete(quotes).where(inArray(quotes.id, quoteIds));
    }

    await db.delete(caseMedia).where(eq(caseMedia.caseId, caseId));
    await db.delete(caseEvents).where(eq(caseEvents.caseId, caseId));
    await db.delete(contractorDismissedCases).where(eq(contractorDismissedCases.caseId, caseId));
    await db.delete(smartCases).where(eq(smartCases.id, caseId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting case:', error);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

router.get('/favorites', async (req: any, res) => {
  try {
    const userId = getUserId(req);

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const favorites = await db.query.favoriteContractors.findMany({
      where: eq(favoriteContractors.orgId, membership.orgId),
      with: {
        contractorUser: {
          with: {
            contractorProfile: {
              with: {
                specialties: {
                  with: {
                    specialty: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/favorites', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { contractorUserId } = req.body;

    if (!contractorUserId) {
      return res.status(400).json({ error: 'Contractor user ID is required' });
    }

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const [favorite] = await db.insert(favoriteContractors).values({
      orgId: membership.orgId,
      contractorUserId,
      addedBy: userId,
    }).returning();

    res.json(favorite);
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/favorites/:id', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.orgRole, 'property_owner')
      ),
    });

    if (!membership) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    await db.delete(favoriteContractors)
      .where(and(
        eq(favoriteContractors.id, id),
        eq(favoriteContractors.orgId, membership.orgId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

export default router;
