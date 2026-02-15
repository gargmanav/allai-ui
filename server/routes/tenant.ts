import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { tenants, smartCases, caseMedia, properties, users, contractorProfiles, contractorOrgLinks, favoriteContractors, userContractorSpecialties, contractorSpecialties, approvalPolicies } from '@shared/schema';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { notificationService } from '../notificationService.js';
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

const createCaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.string().optional(),
  category: z.string().optional(),
  propertyId: z.string().optional(),
  aiTriageJson: z.any().optional(),
  mediaUrls: z.array(z.string()).optional(),
});

// Get tenant info with unit and property
router.get('/info', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userOrgId = req.user!.orgId;
    
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
      with: {
        unit: {
          with: {
            property: true,
          },
        },
      },
    });

    if (!tenant || !tenant.unit) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Validate that the property belongs to the user's organization
    if (tenant.unit.property.orgId !== userOrgId) {
      console.error(`Tenant ${tenant.id} unit/property orgId mismatch: ${tenant.unit.property.orgId} !== ${userOrgId}`);
      return res.status(403).json({ error: 'Organization mismatch' });
    }

    res.json({
      id: tenant.id,
      unitId: tenant.unitId,
      unit: tenant.unit,
    });
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    res.status(500).json({ error: 'Failed to fetch tenant info' });
  }
});

// Get tenant's unit
router.get('/unit', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
      with: {
        unit: {
          with: {
            property: true,
          },
        },
      },
    });

    if (!tenant || !tenant.unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json(tenant.unit);
  } catch (error) {
    console.error('Error fetching tenant unit:', error);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
});

// Get tenant's cases
router.get('/cases', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userOrgId = req.user!.orgId;
    
    // Get tenant record to access unitId for legacy cases
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get cases: either new cases (reporterUserId) or legacy cases (unitId)
    const whereClauses = tenant.unitId 
      ? or(
          eq(smartCases.reporterUserId, userId),
          eq(smartCases.unitId, tenant.unitId)
        )
      : eq(smartCases.reporterUserId, userId);

    const cases = await db.query.smartCases.findMany({
      where: whereClauses,
      with: {
        property: true,
        unit: true,
        media: true,
      },
      orderBy: (cases, { desc }) => [desc(cases.createdAt)],
    });

    const scopedCases = cases.filter(c => {
      const caseOrgId = c.property?.orgId || c.orgId;
      if (caseOrgId !== userOrgId) {
        console.warn(`Filtering out case ${c.id} with orgId ${caseOrgId} (expected ${userOrgId})`);
        return false;
      }
      return true;
    });

    const casesWithMediaUrls = scopedCases.map(c => ({
      ...c,
      media: (c.media || []).map((m: any) => ({
        id: m.id,
        caseId: m.caseId,
        type: m.type,
        caption: m.caption,
        createdAt: m.createdAt,
        url: `/api/media/${m.id}`,
      })),
    }));

    res.json(casesWithMediaUrls);
  } catch (error) {
    console.error('Error fetching tenant cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Create a new case
router.post('/cases', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Get tenant record with full property chain
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
      with: {
        unit: {
          with: {
            property: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Derive orgId from property chain (preferred) or direct tenant.orgId (legacy)
    const derivedOrgId = tenant.unit?.property?.orgId || tenant.orgId;
    
    if (!derivedOrgId) {
      console.error(`Tenant ${tenant.id} cannot create case - no orgId`);
      return res.status(403).json({ error: 'Organization not found for tenant' });
    }

    // Validate derived orgId matches authenticated user's orgId (if set)
    if (req.user!.orgId && derivedOrgId !== req.user!.orgId) {
      console.error(`Tenant ${tenant.id} orgId mismatch: derived ${derivedOrgId} !== auth ${req.user!.orgId}`);
      return res.status(403).json({ error: 'Organization mismatch' });
    }

    // Map AI triage urgency to database priority enum
    const mapUrgencyToPriority = (urgency: string): 'Normal' | 'High' | 'Urgent' => {
      const urgencyLower = urgency.toLowerCase();
      if (urgencyLower === 'critical' || urgencyLower === 'urgent' || urgencyLower === 'emergency' || urgencyLower === 'emergent' || urgencyLower === 'high') return 'Urgent';
      return 'Normal';
    };

    // Get propertyId - use tenant's unit property if available, or fallback to org's first property
    let propertyId: string | null = null;
    let unitId = tenant.unitId || null;
    
    // Priority 1: Use tenant's assigned unit's property
    if (tenant.unit?.propertyId) {
      propertyId = tenant.unit.propertyId;
    }
    // Priority 2: If provided propertyId from request, validate it belongs to the org
    else if (parsed.data.propertyId) {
      const requestedProperty = await db.query.properties.findFirst({
        where: and(
          eq(properties.id, parsed.data.propertyId),
          eq(properties.orgId, derivedOrgId)
        ),
      });
      // Only use if it's validated to belong to tenant's org
      if (requestedProperty) {
        propertyId = requestedProperty.id;
      }
      // Otherwise propertyId stays null (not the untrusted value)
    }
    
    // Priority 3: If still no property, try to get the organization's first property as fallback
    if (!propertyId) {
      const orgProperties = await db.query.properties.findMany({
        where: eq(properties.orgId, derivedOrgId),
        limit: 1,
      });
      if (orgProperties.length > 0) {
        propertyId = orgProperties[0].id;
      }
    }
    
    // Ensure we have a valid property - reject if no org property exists
    if (!propertyId) {
      return res.status(400).json({ error: 'No property available in your organization. Please contact your landlord.' });
    }

    // Create the case
    const [newCase] = await db.insert(smartCases).values({
      title: parsed.data.title,
      description: parsed.data.description,
      orgId: derivedOrgId,
      propertyId: propertyId,
      unitId: unitId,
      reporterUserId: userId,
      status: 'New',
      priority: mapUrgencyToPriority(parsed.data.priority || 'Normal'),
      category: parsed.data.category,
      aiTriageJson: parsed.data.aiTriageJson,
    }).returning();

    // Handle media uploads if provided
    if (parsed.data.mediaUrls && parsed.data.mediaUrls.length > 0) {
      await db.insert(caseMedia).values(
        parsed.data.mediaUrls.map(url => ({
          caseId: newCase.id,
          url,
          type: 'image',
        }))
      );
    }

    // Send notifications (works via WebSocket & database even without SendGrid)
    await Promise.allSettled([
      // Notify tenant (confirmation)
      notificationService.notifyTenant(
        {
          type: 'case_created',
          subject: `Work Order Created: ${newCase.title}`,
          message: `Your maintenance request has been submitted and is being reviewed. We'll notify you when it's assigned to a contractor.`,
          title: 'Request Submitted',
          caseId: newCase.id,
          timestamp: new Date().toISOString(),
        },
        tenant.email,
        userId,
        derivedOrgId
      ),
      // Notify landlord (new case alert)
      notificationService.notifyAdmins(
        {
          type: 'case_created',
          subject: `New Work Order: ${newCase.title}`,
          message: `${tenant.firstName} ${tenant.lastName} reported: ${newCase.description?.substring(0, 100)}`,
          title: 'New Maintenance Request',
          caseId: newCase.id,
          caseNumber: newCase.caseNumber || undefined,
          timestamp: new Date().toISOString(),
        },
        derivedOrgId
      ),
    ]);

    res.json(newCase);
  } catch (error) {
    console.error('Error creating tenant case:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// Upload photos for a case
router.post('/cases/:caseId/photos', requireAuth, requireRole('tenant'), upload.array('photos', 5), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { caseId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
    });

    if (!tenant) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const caseRecord = await db.query.smartCases.findFirst({
      where: and(
        eq(smartCases.id, caseId),
        eq(smartCases.reporterUserId, userId),
        eq(smartCases.orgId, tenant.orgId!)
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
          console.log(`🤖 Photo analysis saved for tenant case ${caseId}`);
        } catch (err) {
          console.error('Failed to save photo analysis:', err);
        }
      }
    }).catch(err => {
      console.error('Photo analysis background task failed:', err);
    });
  } catch (error) {
    console.error('Error uploading tenant photos:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// Maya AI Top-3 Contractor Recommendations
router.get('/maya/contractors', requireAuth, requireRole('tenant'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const userOrgId = req.user!.orgId;
    const category = (req.query.category as string) || '';
    const caseId = req.query.caseId as string | undefined;

    if (!userOrgId) {
      return res.status(403).json({ error: 'Organization not found' });
    }

    // Get tenant info for property context
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.userId, userId),
      with: { unit: { with: { property: true } } },
    });

    // Get org's approval policy (involvement mode + trusted contractors)
    const policy = await db.query.approvalPolicies.findFirst({
      where: and(eq(approvalPolicies.orgId, userOrgId), eq(approvalPolicies.isActive, true)),
    });

    const involvementMode = policy?.involvementMode || 'balanced';
    const trustedIds = (policy?.trustedContractorIds || []).filter(Boolean);

    // Get favorite contractors for this org
    const favorites = await db.query.favoriteContractors.findMany({
      where: eq(favoriteContractors.orgId, userOrgId),
    });
    const favoriteIds = favorites.map(f => f.contractorUserId);

    // Get contractors linked to this org
    const orgLinks = await db.query.contractorOrgLinks.findMany({
      where: and(eq(contractorOrgLinks.orgId, userOrgId), eq(contractorOrgLinks.status, 'active')),
    });

    // Build candidate pool: org-linked contractors + favorites + trusted
    const candidateIds = new Set<string>();
    orgLinks.forEach(l => candidateIds.add(l.contractorUserId));
    favoriteIds.forEach(id => candidateIds.add(id));
    trustedIds.forEach(id => candidateIds.add(id));

    if (candidateIds.size === 0) {
      return res.json({ contractors: [], involvementMode });
    }

    // Get contractor user profiles
    const candidateArray = Array.from(candidateIds);
    const contractorUsers = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
    }).from(users).where(
      and(eq(users.primaryRole, 'contractor'), inArray(users.id, candidateArray))
    );

    // Get contractor profiles for availability info
    const profiles = await db.query.contractorProfiles.findMany({
      where: inArray(contractorProfiles.userId, candidateArray),
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    // Get specialties for filtering by category
    const specialtyLinks = await db.query.userContractorSpecialties.findMany({
      where: inArray(userContractorSpecialties.userId, candidateArray),
    });

    // Get specialty names
    const specialtyIds = [...new Set(specialtyLinks.map(s => s.specialtyId))];
    let specialtyMap = new Map<string, string>();
    if (specialtyIds.length > 0) {
      const specs = await db.query.contractorSpecialties.findMany({
        where: inArray(contractorSpecialties.id, specialtyIds),
      });
      specialtyMap = new Map(specs.map(s => [s.id, s.name]));
    }

    // Build user → specialties mapping
    const userSpecialties = new Map<string, string[]>();
    specialtyLinks.forEach(sl => {
      const name = specialtyMap.get(sl.specialtyId);
      if (name) {
        const existing = userSpecialties.get(sl.userId) || [];
        existing.push(name);
        userSpecialties.set(sl.userId, existing);
      }
    });

    // Get org link stats for rating info
    const linkMap = new Map(orgLinks.map(l => [l.contractorUserId, l]));

    // Score and rank contractors
    const scored = contractorUsers.map(cu => {
      const profile = profileMap.get(cu.id);
      const link = linkMap.get(cu.id);
      const specs = userSpecialties.get(cu.id) || [];
      const isTrusted = trustedIds.includes(cu.id);
      const isFavorite = favoriteIds.includes(cu.id);
      const isAvailable = profile?.isAvailable !== false;
      const rating = link?.averageRating ? parseFloat(link.averageRating) : 0;
      const jobsCompleted = link?.totalJobsCompleted || 0;

      // Category match scoring
      const categoryLower = category.toLowerCase();
      const categoryMatch = category ? specs.some(s => s.toLowerCase().includes(categoryLower) || categoryLower.includes(s.toLowerCase())) : true;

      // Scoring influenced by involvementMode:
      // hands-off: heavily favor trusted/favorite, auto-assign without landlord review
      // balanced: mix of trusted preference and open pool
      // hands-on: landlord will review, so broader pool is fine
      let score = 0;
      
      if (involvementMode === 'hands-off') {
        if (isTrusted) score += 200;
        if (isFavorite) score += 150;
        if (categoryMatch) score += 30;
        if (isAvailable) score += 20;
      } else if (involvementMode === 'hands-on') {
        if (isTrusted) score += 50;
        if (isFavorite) score += 30;
        if (categoryMatch) score += 60;
        if (isAvailable) score += 40;
      } else {
        if (isTrusted) score += 100;
        if (isFavorite) score += 50;
        if (categoryMatch) score += 30;
        if (isAvailable) score += 20;
      }
      score += rating * 5;
      score += Math.min(jobsCompleted, 10);

      return {
        id: cu.id,
        firstName: cu.firstName,
        lastName: cu.lastName,
        profileImageUrl: cu.profileImageUrl,
        specialties: specs,
        rating: rating || null,
        jobsCompleted,
        isAvailable,
        isTrusted,
        isFavorite,
        categoryMatch,
        responseTimeHours: profile?.responseTimeHours || 24,
        emergencyAvailable: profile?.emergencyAvailable || false,
        score,
      };
    });

    // Filter: only available contractors that match category (if specified)
    let filtered = scored.filter(c => c.isAvailable);
    if (category) {
      const categoryMatches = filtered.filter(c => c.categoryMatch);
      if (categoryMatches.length > 0) {
        filtered = categoryMatches;
      }
    }
    
    // In hands-off mode, strongly prefer trusted/favorite contractors
    if (involvementMode === 'hands-off') {
      const trustedOrFav = filtered.filter(c => c.isTrusted || c.isFavorite);
      if (trustedOrFav.length > 0) {
        filtered = trustedOrFav;
      }
    }

    // Sort by score descending, take top 3
    filtered.sort((a, b) => b.score - a.score);
    const top3 = filtered.slice(0, 3);

    // Strip internal scoring before sending to tenant (no pricing info)
    const result = top3.map((c, idx) => ({
      rank: idx + 1,
      id: c.id,
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Contractor',
      profileImageUrl: c.profileImageUrl,
      specialties: c.specialties,
      rating: c.rating,
      responseTimeHours: c.responseTimeHours,
      emergencyAvailable: c.emergencyAvailable,
      isTrusted: c.isTrusted,
      isFavorite: c.isFavorite,
      jobsCompleted: c.jobsCompleted,
      mayaNote: c.isTrusted ? 'Trusted by your landlord' : c.isFavorite ? 'Preferred contractor' : c.categoryMatch ? 'Specialist match' : 'Available now',
    }));

    res.json({
      contractors: result,
      involvementMode,
      totalCandidates: candidateIds.size,
    });
  } catch (error) {
    console.error('Error fetching Maya contractor recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch contractor recommendations' });
  }
});

export default router;
