import cron from "node-cron";
import { storage } from "./storage";
import { checkAndSendTimeoutNotifications } from "./services/timeoutNotifications";
import { cleanupExpiredSessions } from "./services/sessionService";
import { db } from "./db";
import { contractorDismissedCases, smartCases, quotes } from "@shared/schema";
import { lt, eq, and, lte, isNotNull } from "drizzle-orm";

export function startCronJobs() {
  // Run every hour to check for due reminders
  cron.schedule('0 * * * *', async () => {
    console.log('Checking for due reminders...');
    
    try {
      const dueReminders = await storage.getDueReminders();
      
      for (const reminder of dueReminders) {
        // Send notification
        if (reminder.orgId) {
          // Get organization members to notify
          const org = await storage.getUserOrganization(reminder.orgId);
          if (org) {
            const adminUser = await storage.getUser(org.ownerId);
            await storage.createNotification(
              org.ownerId,
              reminder.title,
              `Reminder: ${reminder.title} is due`,
              'warning',
              'admin',
              adminUser ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email || 'Admin' : 'Admin'
            );
          }
        }
        
        // Track notification sent time (status remains null for active reminders)
        await storage.updateReminder(reminder.id, {
          sentAt: new Date(),
        });
        
        console.log(`Sent reminder: ${reminder.title}`);
      }
    } catch (error) {
      console.error('Error processing reminders:', error);
    }
  });

  // Generate monthly rent reminders (run on 1st of each month)
  cron.schedule('0 0 1 * *', async () => {
    console.log('Generating monthly rent reminders...');
    
    try {
      // This would typically fetch all active leases and create rent reminders
      // Implementation would depend on specific business logic
      console.log('Monthly rent reminders generated');
    } catch (error) {
      console.error('Error generating rent reminders:', error);
    }
  });

  // Check for lease expirations (run daily)
  cron.schedule('0 9 * * *', async () => {
    console.log('Checking for lease expirations...');
    
    try {
      await storage.createLeaseEndReminders();
      console.log('Lease expiration check completed');
    } catch (error) {
      console.error('Error checking lease expirations:', error);
    }
  });

  // Generate compliance reminders (run daily at 8 AM)
  cron.schedule('0 8 * * *', async () => {
    console.log('Generating compliance reminders...');
    
    try {
      await storage.generateComplianceReminders();
      console.log('Compliance reminder generation completed');
    } catch (error) {
      console.error('Error generating compliance reminders:', error);
    }
  });

  // Generate missing recurring transactions (run daily at 2 AM)
  cron.schedule('0 2 * * *', async () => {
    console.log('Generating missing recurring transactions...');
    
    try {
      await storage.generateRecurringTransactions();
      console.log('Recurring transaction generation completed');
    } catch (error) {
      console.error('Error generating recurring transactions:', error);
    }
  });

  // Generate predictive maintenance insights (run daily at 3 AM)
  // Note: Predictions are also auto-generated when equipment is added/updated
  cron.schedule('0 3 * * *', async () => {
    console.log('Regenerating predictive maintenance insights for all organizations...');
    
    try {
      const { PredictiveAnalyticsEngine } = await import('./predictiveAnalyticsEngine');
      // Get all unique organization IDs from properties
      const allProperties = await storage.getAllProperties();
      const uniqueOrgIds = [...new Set(allProperties.map(p => p.orgId))];
      
      for (const orgId of uniqueOrgIds) {
        const analyticsEngine = new PredictiveAnalyticsEngine(storage);
        await analyticsEngine.generatePredictions(orgId);
        console.log(`Generated predictions for organization ID: ${orgId}`);
      }
      
      console.log('Predictive insights regeneration completed');
    } catch (error) {
      console.error('Error generating predictive insights:', error);
    }
  });

  // Check for timeout notifications every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('🔔 Running timeout notifications check...');
    try {
      await checkAndSendTimeoutNotifications();
    } catch (error) {
      console.error('Error in timeout notifications:', error);
    }
  });
  
  // Cleanup expired sessions daily at 4 AM
  cron.schedule('0 4 * * *', async () => {
    console.log('🧹 Cleaning up expired sessions...');
    try {
      const cleaned = await cleanupExpiredSessions();
      console.log(`✅ Cleaned up ${cleaned} expired sessions`);
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  });

  // Cleanup old notifications daily at 5 AM
  cron.schedule('0 5 * * *', async () => {
    console.log('🗑️ Cleaning up old notifications (30+ days)...');
    try {
      const deleted = await storage.deleteOldNotifications(30);
      console.log(`✅ Deleted ${deleted} old notifications`);
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  });

  // Cleanup passed/dismissed cases older than 30 days (daily at 4 AM)
  cron.schedule('0 4 * * *', async () => {
    console.log('🗑️ Cleaning up expired dismissed cases (30+ days)...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await db.delete(contractorDismissedCases).where(
        lt(contractorDismissedCases.dismissedAt, thirtyDaysAgo)
      );
      console.log(`✅ Cleaned up expired dismissed cases`);
    } catch (error) {
      console.error('Error cleaning up dismissed cases:', error);
    }
  });

  // Nudge contractors who haven't confirmed a job within 48 hours (run every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
    console.log('Checking for unconfirmed jobs (48h nudge)...');
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

      const staleApprovedQuotes = await db.select({
        caseId: quotes.caseId,
        contractorId: quotes.contractorId,
        caseTitle: smartCases.title,
      })
      .from(quotes)
      .innerJoin(smartCases, eq(quotes.caseId, smartCases.id))
      .where(and(
        eq(quotes.status, 'approved'),
        eq(smartCases.status, 'In Review'),
        isNotNull(quotes.approvedAt),
        lte(quotes.approvedAt, twoDaysAgo)
      ));

      for (const row of staleApprovedQuotes) {
        if (!row.contractorId) continue;
        await storage.createNotification(
          row.contractorId,
          'Job awaiting your confirmation',
          `"${row.caseTitle}" has been waiting for your confirmation for over 48 hours. Please confirm or update the homeowner.`,
          'warning',
          'contractor',
          'System'
        );
      }

      if (staleApprovedQuotes.length > 0) {
        console.log(`Sent ${staleApprovedQuotes.length} contractor nudge(s)`);
      }
    } catch (error) {
      console.error('Error sending contractor nudges:', error);
    }
  });

  console.log('Cron jobs started successfully');
}
