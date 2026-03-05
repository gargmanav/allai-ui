import { Router } from 'express';
import { requireAuth, requirePlatformAdmin, AuthenticatedRequest } from '../middleware/rbac';
import { db } from '../db';
import { users, organizations, organizationMembers, properties, contractorProfiles, smartCases, tenants, tenantGroups, userContractorSpecialties, contractorSpecialties, favoriteContractors, scheduledJobs, vendors } from '@shared/schema';
import { eq, count, sql, and, ne, gte, desc, isNull, or } from 'drizzle-orm';
import { startOrgImpersonation, stopImpersonation, revokeAllUserSessions } from '../services/sessionService';

const router = Router();

// Get system-wide statistics
router.get('/stats', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const [orgCount] = await db.select({ count: count() }).from(organizations);
    const [userCount] = await db.select({ count: count() }).from(users);
    const [contractorCount] = await db.select({ count: count() })
      .from(contractorProfiles);
    const [propertyCount] = await db.select({ count: count() }).from(properties);
    const [openCaseCount] = await db.select({ count: count() })
      .from(smartCases)
      .where(and(
        ne(smartCases.status, 'Resolved'),
        ne(smartCases.status, 'Closed')
      ));

    // Calculate active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [activeUserCount] = await db.select({ count: count() })
      .from(users)
      .where(gte(users.updatedAt, thirtyDaysAgo));

    res.json({
      orgCount: orgCount.count,
      userCount: userCount.count,
      activeUserCount: activeUserCount.count,
      contractorCount: contractorCount.count,
      propertyCount: propertyCount.count,
      openCaseCount: openCaseCount.count,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get all organizations
router.get('/organizations', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const orgs = await db.query.organizations.findMany({
      with: {
        properties: true,
      },
      orderBy: (orgs, { desc }) => [desc(orgs.createdAt)],
    });

    // Get owner info, case counts, and tenant counts for each org
    const orgsWithDetails = await Promise.all(orgs.map(async (org) => {
      const owner = await db.query.users.findFirst({
        where: eq(users.id, org.ownerId),
      });
      
      const [caseCount] = await db.select({ count: count() })
        .from(smartCases)
        .where(eq(smartCases.orgId, org.id));
      
      const [tenantCount] = await db.select({ count: count() })
        .from(tenants)
        .innerJoin(tenantGroups, eq(tenants.groupId, tenantGroups.id))
        .where(eq(tenantGroups.orgId, org.id));

      return {
        ...org,
        ownerName: owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email : 'Unknown',
        ownerEmail: owner?.email,
        _count: {
          properties: org.properties?.length || 0,
          cases: caseCount.count,
          tenants: tenantCount.count,
        },
      };
    }));

    res.json(orgsWithDetails);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get all users with analytics
router.get('/users', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const allUsers = await db.query.users.findMany({
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });

    // Enrich with analytics data
    const usersWithAnalytics = allUsers.map(user => {
      const lastLogin = user.updatedAt;
      const daysSinceLogin = lastLogin ? Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24)) : null;
      
      // Determine activity status
      let activityStatus = 'inactive';
      if (daysSinceLogin === null) {
        activityStatus = 'never_logged_in';
      } else if (daysSinceLogin <= 7) {
        activityStatus = 'very_active';
      } else if (daysSinceLogin <= 30) {
        activityStatus = 'active';
      } else if (daysSinceLogin <= 90) {
        activityStatus = 'inactive';
      } else {
        activityStatus = 'dormant';
      }

      return {
        ...user,
        lastLoginAt: lastLogin,
        daysSinceLogin,
        activityStatus,
      };
    });

    res.json(usersWithAnalytics);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get contractor marketplace analytics
router.get('/contractors', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Get all contractors with their profiles
    const contractors = await db.select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      profileId: contractorProfiles.id,
      bio: contractorProfiles.bio,
      isAvailable: contractorProfiles.isAvailable,
      emergencyAvailable: contractorProfiles.emergencyAvailable,
      maxJobsPerDay: contractorProfiles.maxJobsPerDay,
      responseTimeHours: contractorProfiles.responseTimeHours,
    })
    .from(users)
    .innerJoin(contractorProfiles, eq(users.id, contractorProfiles.userId))
    .where(eq(users.primaryRole, 'contractor'))
    .orderBy(desc(users.createdAt));

    // Enrich with specialties, job stats, and favorites
    const contractorsWithDetails = await Promise.all(contractors.map(async (contractor) => {
      // Get specialties
      const specialties = await db.select({
        name: contractorSpecialties.name,
        tier: contractorSpecialties.tier,
      })
      .from(userContractorSpecialties)
      .innerJoin(contractorSpecialties, eq(userContractorSpecialties.specialtyId, contractorSpecialties.id))
      .where(eq(userContractorSpecialties.userId, contractor.userId));

      // Get job stats
      const [totalJobsResult] = await db.select({ count: count() })
        .from(smartCases)
        .where(eq(smartCases.assignedContractorId, contractor.userId));

      const [completedJobsResult] = await db.select({ count: count() })
        .from(smartCases)
        .where(and(
          eq(smartCases.assignedContractorId, contractor.userId),
          eq(smartCases.status, 'Resolved')
        ));

      const [activeJobsResult] = await db.select({ count: count() })
        .from(smartCases)
        .where(and(
          eq(smartCases.assignedContractorId, contractor.userId),
          ne(smartCases.status, 'Resolved'),
          ne(smartCases.status, 'Closed')
        ));

      // Get favorite count
      const [favoriteCountResult] = await db.select({ count: count() })
        .from(favoriteContractors)
        .where(eq(favoriteContractors.contractorUserId, contractor.userId));

      // Get scheduled jobs count (join through vendors table)
      const [scheduledJobsResult] = await db.select({ count: count() })
        .from(scheduledJobs)
        .innerJoin(vendors, eq(scheduledJobs.contractorId, vendors.id))
        .where(eq(vendors.userId, contractor.userId));

      // Calculate activity status
      const lastLogin = contractor.updatedAt;
      const daysSinceLogin = lastLogin ? Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24)) : null;
      
      let activityStatus = 'inactive';
      if (daysSinceLogin === null) {
        activityStatus = 'never_logged_in';
      } else if (daysSinceLogin <= 7) {
        activityStatus = 'very_active';
      } else if (daysSinceLogin <= 30) {
        activityStatus = 'active';
      } else {
        activityStatus = 'inactive';
      }

      return {
        ...contractor,
        specialties: specialties.map(s => s.name),
        specialtyTiers: specialties.map(s => s.tier),
        totalJobs: totalJobsResult.count,
        completedJobs: completedJobsResult.count,
        activeJobs: activeJobsResult.count,
        scheduledJobs: scheduledJobsResult.count,
        favoriteCount: favoriteCountResult.count,
        daysSinceLogin,
        activityStatus,
        marketplaceActive: contractor.isAvailable && activityStatus !== 'inactive',
      };
    }));

    res.json(contractorsWithDetails);
  } catch (error) {
    console.error('Error fetching contractor analytics:', error);
    res.status(500).json({ error: 'Failed to fetch contractor analytics' });
  }
});

// Superadmin: Impersonate/view as an organization
router.post('/impersonate/:orgId', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { orgId } = req.params;

    // Verify organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Store in session via sessionService
    if (!req.sessionId) {
      return res.status(500).json({ error: 'Session ID not found' });
    }

    const success = await startOrgImpersonation(req.sessionId, orgId, org.name);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to start impersonation' });
    }

    res.json({
      success: true,
      orgId,
      orgName: org.name,
      message: `Now viewing as organization: ${org.name}`,
    });
  } catch (error) {
    console.error('Error starting org impersonation:', error);
    res.status(500).json({ error: 'Failed to impersonate organization' });
  }
});

// Superadmin: Stop impersonating and return to superadmin view
router.post('/stop-impersonation', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.sessionId) {
      return res.status(500).json({ error: 'Session ID not found' });
    }

    const success = await stopImpersonation(req.sessionId);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to stop impersonation' });
    }

    res.json({
      success: true,
      message: 'Returned to superadmin view',
    });
  } catch (error) {
    console.error('Error stopping org impersonation:', error);
    res.status(500).json({ error: 'Failed to stop impersonation' });
  }
});

// Change a user's role
router.patch('/users/:userId/role', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const validRoles = ['platform_super_admin', 'org_admin', 'property_owner', 'contractor', 'tenant'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const [updated] = await db.update(users).set({ primaryRole: role as any }).where(eq(users.id, userId)).returning();
    if (!updated) return res.status(404).json({ error: 'User not found' });
    // Update org membership role too
    await db.update(organizationMembers).set({ orgRole: role as any }).where(eq(organizationMembers.userId, userId));
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Error changing user role:', error);
    res.status(500).json({ error: 'Failed to change role' });
  }
});

// Deactivate a user (revoke sessions + mark membership inactive)
router.patch('/users/:userId/deactivate', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    await db.update(organizationMembers).set({ membershipStatus: 'inactive' }).where(eq(organizationMembers.userId, userId));
    await revokeAllUserSessions(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Reactivate a user
router.patch('/users/:userId/reactivate', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    await db.update(organizationMembers).set({ membershipStatus: 'active' }).where(eq(organizationMembers.userId, userId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error reactivating user:', error);
    res.status(500).json({ error: 'Failed to reactivate user' });
  }
});

// Get recent platform activity feed
router.get('/activity', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const recentUsers = await db.select({
      id: users.id,
      label: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
      email: users.email,
      role: users.primaryRole,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(12);

    const recentOrgs = await db.select({
      id: organizations.id,
      name: organizations.name,
      createdAt: organizations.createdAt,
    }).from(organizations).orderBy(desc(organizations.createdAt)).limit(8);

    const recentCases = await db.select({
      id: smartCases.id,
      title: smartCases.title,
      status: smartCases.status,
      priority: smartCases.priority,
      orgId: smartCases.orgId,
      createdAt: smartCases.createdAt,
    }).from(smartCases).orderBy(desc(smartCases.createdAt)).limit(10);

    const events: Array<{ id: string; type: string; title: string; subtitle: string; createdAt: Date; priority?: string }> = [
      ...recentUsers.map(u => ({
        id: u.id, type: 'user_signup',
        title: `New ${u.role?.replace('_', ' ') || 'user'} joined`,
        subtitle: u.email,
        createdAt: u.createdAt!,
      })),
      ...recentOrgs.map(o => ({
        id: o.id, type: 'org_created',
        title: 'New organization created',
        subtitle: o.name,
        createdAt: o.createdAt!,
      })),
      ...recentCases.map(c => ({
        id: String(c.id), type: 'case_opened',
        title: 'Maintenance case opened',
        subtitle: c.title || 'Untitled case',
        priority: c.priority || undefined,
        createdAt: c.createdAt!,
      })),
    ];

    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(events.slice(0, 25));
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Get all properties across the platform
router.get('/properties', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const allProps = await db.select({
      id: properties.id,
      name: properties.name,
      type: properties.type,
      street: properties.street,
      city: properties.city,
      state: properties.state,
      zipCode: properties.zipCode,
      orgId: properties.orgId,
      orgName: organizations.name,
      createdAt: properties.createdAt,
    })
    .from(properties)
    .leftJoin(organizations, eq(properties.orgId, organizations.id))
    .orderBy(desc(properties.createdAt));

    // Attach open case count per property
    const withCases = await Promise.all(allProps.map(async (p) => {
      const [caseCount] = await db.select({ count: count() })
        .from(smartCases)
        .where(and(
          eq(smartCases.propertyId, p.id),
          ne(smartCases.status, 'Resolved'),
          ne(smartCases.status, 'Closed'),
        ));
      return { ...p, openCases: caseCount.count };
    }));

    res.json(withCases);
  } catch (error) {
    console.error('Error fetching admin properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get all active cases across the platform
router.get('/cases', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const allCases = await db.select({
      id: smartCases.id,
      title: smartCases.title,
      status: smartCases.status,
      priority: smartCases.priority,
      category: smartCases.category,
      orgId: smartCases.orgId,
      orgName: organizations.name,
      propertyId: smartCases.propertyId,
      createdAt: smartCases.createdAt,
    })
    .from(smartCases)
    .leftJoin(organizations, eq(smartCases.orgId, organizations.id))
    .where(and(
      ne(smartCases.status, 'Resolved'),
      ne(smartCases.status, 'Closed'),
    ))
    .orderBy(desc(smartCases.createdAt));

    res.json(allCases);
  } catch (error) {
    console.error('Error fetching admin cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// Get current impersonation status
router.get('/impersonation-status', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.viewAsOrgId) {
      // Get org name from database
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, req.user.viewAsOrgId),
      });

      res.json({
        isImpersonating: true,
        orgId: req.user.viewAsOrgId,
        orgName: org?.name || 'Unknown Organization',
      });
    } else {
      res.json({
        isImpersonating: false,
      });
    }
  } catch (error) {
    console.error('Error getting impersonation status:', error);
    res.status(500).json({ error: 'Failed to get impersonation status' });
  }
});

export default router;
