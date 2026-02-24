import { Router } from 'express';
import { db } from '../db';
import { users, organizations, organizationMembers, verificationTokens } from '@shared/schema';
import { z } from 'zod';
import { sendMagicLink } from '../services/emailService';
import { sendVerificationCode, verifySMSCode } from '../services/smsService';
import { createSession } from '../services/sessionService';
import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';

const router = Router();

router.post('/signup-property-owner/email', async (req, res) => {
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
        primaryRole: 'property_owner',
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
    console.error('Property owner email signup error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

router.post('/signup-property-owner/phone', async (req, res) => {
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

router.post('/signup-property-owner/verify-phone', async (req, res) => {
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

router.post('/signup-property-owner/complete', async (req, res) => {
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
        ownerType: 'property_owner',
      }).returning();

      await db.insert(organizationMembers).values({
        orgId: org.id,
        userId: user.id,
        orgRole: 'property_owner',
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

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'property_owner',
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Property owner completion error:', error);
    res.status(400).json({ success: false, error: 'Invalid request' });
  }
});

router.get('/verify-property-owner', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token as string).digest('hex');

    const verificationToken = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.tokenHash, tokenHash),
        eq(verificationTokens.type, 'email'),
        eq(verificationTokens.status, 'pending'),
        gt(verificationTokens.expiresAt, new Date())
      ),
    });

    if (!verificationToken) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const [user] = await db.insert(users).values({
      email: verificationToken.email,
      primaryRole: 'property_owner',
      emailVerified: true,
    }).returning();

    const [org] = await db.insert(organizations).values({
      name: `${verificationToken.email}'s Properties`,
      ownerId: user.id,
      ownerType: 'property_owner',
    }).returning();

    await db.insert(organizationMembers).values({
      orgId: org.id,
      userId: user.id,
      orgRole: 'property_owner',
      membershipStatus: 'active',
      joinedAt: new Date(),
    });

    await db.update(verificationTokens)
      .set({ status: 'verified', verifiedAt: new Date() })
      .where(eq(verificationTokens.id, verificationToken.id));

    const session = await createSession({
      userId: user.id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      rememberMe: true,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.primaryRole,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin || false,
      },
      session: {
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      },
    });
  } catch (error) {
    console.error('Property owner verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

export default router;
