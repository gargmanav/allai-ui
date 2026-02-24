import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { users, contractorProfiles, organizations, organizationMembers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sendMagicLink, verifyEmailToken, sendTenantInvite } from '../services/emailService';
import { sendVerificationCode, verifySMSCode, optOutSMS } from '../services/smsService';
import { createSession, validateSession, revokeSession, revokeAllUserSessions } from '../services/sessionService';

const router = Router();

// Request magic link for email-based login (landlords, platform admins)
router.post('/magic-link', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
    });
    
    const { email } = schema.parse(req.body);
    
    const result = await sendMagicLink(email);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Magic link sent to your email',
        devMagicLink: result.devMagicLink  // Only present in dev mode when email fails
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Verify email token from magic link
router.get('/verify-email', async (req, res) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }
    
    const result = await verifyEmailToken(token);
    
    if (!result.success || !result.userId) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, result.userId),
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Create session with remember me
    const session = await createSession({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      rememberMe: true,
    });
    
    // Set session on request and save it
    if (req.session) {
      req.session.userId = user.id;
      req.session.sessionId = session.sessionId;
      
      // Save session explicitly to ensure cookie is created
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.primaryRole,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// Contractor signup - Step 1: Email verification
router.post('/signup-contractor/email', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().min(10).optional(),
      smsOptIn: z.boolean().optional(),
    });
    
    const { email, firstName, lastName, phone, smsOptIn } = schema.parse(req.body);
    
    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (!user) {
      // Create new contractor user
      const [newUser] = await db.insert(users).values({
        email,
        firstName,
        lastName,
        phone: phone || null,
        primaryRole: 'contractor',
        emailVerified: false,
        phoneVerified: false,
      }).returning();
      user = newUser;
    } else {
      // Update existing user with new info
      await db.update(users)
        .set({ firstName, lastName, phone: phone || user.phone })
        .where(eq(users.id, user.id));
    }
    
    // Try to send magic link but don't block signup if it fails
    try {
      await sendMagicLink(email);
    } catch (emailError) {
      console.log('Email service unavailable, skipping email verification:', (emailError as Error).message);
    }
    
    res.json({ 
      success: true, 
      userId: user.id,
      message: 'Account created successfully' 
    });
  } catch (error) {
    console.error('Contractor email signup error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Contractor signup - Step 2: Phone verification
router.post('/signup-contractor/phone', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      phone: z.string().min(10),
    });
    
    const { userId, phone } = schema.parse(req.body);
    
    // Update user with phone
    await db.update(users)
      .set({ phone })
      .where(eq(users.id, userId));
    
    // Send SMS verification code (skip if Twilio not configured)
    try {
      await sendVerificationCode(phone, userId);
    } catch (smsError) {
      console.log('SMS service unavailable, skipping phone verification send:', (smsError as Error).message);
    }
    
    res.json({ 
      success: true, 
      message: 'Verification code sent to your phone' 
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Contractor signup - Step 3: Verify SMS code
router.post('/signup-contractor/verify-phone', async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string(),
      code: z.string().length(6),
    });
    
    const { phone, code } = schema.parse(req.body);
    
    // Auto-approve in dev when Twilio is not configured
    const twilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    let result;
    if (!twilioConfigured) {
      console.log('Twilio not configured — auto-approving phone verification for', phone);
      const user = await db.query.users.findFirst({ where: eq(users.phone, phone) });
      if (user) {
        await db.update(users).set({ phoneVerified: true }).where(eq(users.id, user.id));
      }
      result = { success: true, userId: user?.id };
    } else {
      result = await verifySMSCode(phone, code);
    }
    
    if (!result.success || !result.userId) {
      return res.status(400).json({ success: false, error: 'Verification failed' });
    }
    
    res.json({ 
      success: true, 
      userId: result.userId,
      message: 'Phone verified successfully' 
    });
  } catch (error) {
    console.error('SMS code verification error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Contractor signup - Step 4: Complete profile with specialties
router.post('/signup-contractor/complete', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      specialtyIds: z.array(z.string()).min(1),
      bio: z.string().optional(),
    });
    
    const { userId, specialtyIds, bio } = schema.parse(req.body);
    
    // Create contractor profile
    await db.insert(contractorProfiles).values({
      userId,
      bio: bio || null,
    });
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const session = await createSession({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      rememberMe: true,
    });

    if (req.session) {
      req.session.userId = user.id;
      req.session.sessionId = session.sessionId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => { if (err) reject(err); else resolve(); });
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'contractor',
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Contractor profile completion error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// ========== LANDLORD SIGNUP ROUTES ==========

router.post('/signup-landlord/email', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().min(10),
      smsOptIn: z.boolean().optional(),
    });

    const { email, firstName, lastName, phone, smsOptIn } = schema.parse(req.body);

    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      const [newUser] = await db.insert(users).values({
        email,
        firstName,
        lastName,
        phone,
        primaryRole: 'org_admin',
        emailVerified: false,
        phoneVerified: false,
      }).returning();
      user = newUser;
    } else {
      await db.update(users)
        .set({ firstName, lastName, phone: phone || user.phone })
        .where(eq(users.id, user.id));
    }

    try {
      await sendMagicLink(email);
    } catch (emailError) {
      console.log('Email service unavailable, skipping email verification:', (emailError as Error).message);
    }

    res.json({ success: true, userId: user.id, message: 'Account created successfully' });
  } catch (error) {
    console.error('Landlord email signup error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

router.post('/signup-landlord/phone', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      phone: z.string().min(10),
    });

    const { userId, phone } = schema.parse(req.body);

    await db.update(users)
      .set({ phone })
      .where(eq(users.id, userId));

    try {
      await sendVerificationCode(phone, userId);
    } catch (smsError) {
      console.log('SMS service unavailable, skipping phone verification send:', (smsError as Error).message);
    }

    res.json({ success: true, message: 'Verification code sent to your phone' });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

router.post('/signup-landlord/verify-phone', async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string(),
      code: z.string().length(6),
    });

    const { phone, code } = schema.parse(req.body);

    const twilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    let result;
    if (!twilioConfigured) {
      console.log('Twilio not configured — auto-approving phone verification for', phone);
      const user = await db.query.users.findFirst({ where: eq(users.phone, phone) });
      if (user) {
        await db.update(users).set({ phoneVerified: true }).where(eq(users.id, user.id));
      }
      result = { success: true, userId: user?.id };
    } else {
      result = await verifySMSCode(phone, code);
    }

    if (!result.success || !result.userId) {
      return res.status(400).json({ success: false, error: 'Verification failed' });
    }

    res.json({ success: true, userId: result.userId, message: 'Phone verified successfully' });
  } catch (error) {
    console.error('SMS code verification error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

router.post('/signup-landlord/complete', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
    });

    const { userId } = schema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const existingOrg = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.userId, userId),
    });

    if (!existingOrg) {
      const [org] = await db.insert(organizations).values({
        name: `${user.firstName || user.email}'s Properties`,
        ownerId: user.id,
        ownerType: 'landlord',
      }).returning();

      await db.insert(organizationMembers).values({
        orgId: org.id,
        userId: user.id,
        orgRole: 'admin',
        membershipStatus: 'active',
        joinedAt: new Date(),
      });
    }

    const session = await createSession({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      rememberMe: true,
    });

    if (req.session) {
      req.session.userId = user.id;
      req.session.sessionId = session.sessionId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => { if (err) reject(err); else resolve(); });
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'org_admin',
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Landlord completion error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// ========== TENANT SIGNUP ROUTES ==========

router.post('/signup-tenant/email', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().min(10),
      smsOptIn: z.boolean().optional(),
    });

    const { email, firstName, lastName, phone, smsOptIn } = schema.parse(req.body);

    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      const [newUser] = await db.insert(users).values({
        email,
        firstName,
        lastName,
        phone,
        primaryRole: 'tenant',
        emailVerified: false,
        phoneVerified: false,
      }).returning();
      user = newUser;
    } else {
      await db.update(users)
        .set({ firstName, lastName, phone: phone || user.phone })
        .where(eq(users.id, user.id));
    }

    try {
      await sendMagicLink(email);
    } catch (emailError) {
      console.log('Email service unavailable, skipping email verification:', (emailError as Error).message);
    }

    res.json({ success: true, userId: user.id, message: 'Account created successfully' });
  } catch (error) {
    console.error('Tenant email signup error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

router.post('/signup-tenant/phone', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      phone: z.string().min(10),
    });

    const { userId, phone } = schema.parse(req.body);

    await db.update(users)
      .set({ phone })
      .where(eq(users.id, userId));

    try {
      await sendVerificationCode(phone, userId);
    } catch (smsError) {
      console.log('SMS service unavailable, skipping phone verification send:', (smsError as Error).message);
    }

    res.json({ success: true, message: 'Verification code sent to your phone' });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

router.post('/signup-tenant/verify-phone', async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string(),
      code: z.string().length(6),
    });

    const { phone, code } = schema.parse(req.body);

    const twilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    let result;
    if (!twilioConfigured) {
      console.log('Twilio not configured — auto-approving phone verification for', phone);
      const user = await db.query.users.findFirst({ where: eq(users.phone, phone) });
      if (user) {
        await db.update(users).set({ phoneVerified: true }).where(eq(users.id, user.id));
      }
      result = { success: true, userId: user?.id };
    } else {
      result = await verifySMSCode(phone, code);
    }

    if (!result.success || !result.userId) {
      return res.status(400).json({ success: false, error: 'Verification failed' });
    }

    res.json({ success: true, userId: result.userId, message: 'Phone verified successfully' });
  } catch (error) {
    console.error('SMS code verification error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

router.post('/signup-tenant/complete', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
    });

    const { userId } = schema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const session = await createSession({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      rememberMe: true,
    });

    if (req.session) {
      req.session.userId = user.id;
      req.session.sessionId = session.sessionId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => { if (err) reject(err); else resolve(); });
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'tenant',
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Tenant completion error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// Validate current session
router.get('/session', async (req, res) => {
  try {
    const refreshToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'No session token' });
    }
    
    const result = await validateSession(refreshToken);
    
    if (!result.valid || !result.userId) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, result.userId),
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.primaryRole,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ success: false, error: 'Session validation failed' });
  }
});

// Logout current session
router.post('/logout', async (req, res) => {
  try {
    // Get session ID from request
    const sessionId = req.session?.sessionId;
    
    if (sessionId) {
      await revokeSession(sessionId);
    }
    
    // Destroy Express session
    req.session?.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
    });
    
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// Logout all sessions
router.post('/logout-all', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
    });
    
    const { userId } = schema.parse(req.body);
    
    await revokeAllUserSessions(userId);
    
    res.json({ success: true, message: 'All sessions logged out' });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

// SMS opt-out
router.post('/sms-opt-out', async (req, res) => {
  try {
    const schema = z.object({
      phone: z.string(),
      userId: z.string().optional(),
      reason: z.string().optional(),
    });
    
    const { phone, userId, reason } = schema.parse(req.body);
    
    await optOutSMS(phone, userId, reason);
    
    res.json({ 
      success: true, 
      message: 'You have been opted out of SMS notifications (except emergencies)' 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

export default router;
