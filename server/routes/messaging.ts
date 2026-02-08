import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/rbac";

const router = Router();

router.use(requireAuth);

router.get("/conversations", async (req: any, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let conversations;
    if (role === "contractor") {
      conversations = await storage.getContractorConversations(userId);
    } else {
      conversations = await storage.getHomeownerConversations(userId);
    }
    res.json(conversations);
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/conversations/:threadId/messages", async (req: any, res) => {
  try {
    const { threadId } = req.params;
    const thread = await storage.getMessageThread(threadId);
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    const userId = req.user.id;
    if (thread.homeownerUserId !== userId && thread.contractorUserId !== userId) {
      return res.status(403).json({ error: "Not a participant" });
    }

    const messages = await storage.getThreadMessages(threadId);

    await storage.markThreadAsRead(threadId, userId);

    res.json(messages);
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/conversations/:threadId/messages", async (req: any, res) => {
  try {
    const { threadId } = req.params;
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const thread = await storage.getMessageThread(threadId);
    if (!thread) return res.status(404).json({ error: "Thread not found" });

    const userId = req.user.id;
    if (thread.homeownerUserId !== userId && thread.contractorUserId !== userId) {
      return res.status(403).json({ error: "Not a participant" });
    }

    const message = await storage.sendMessage({
      threadId,
      senderId: userId,
      body: body.trim(),
    });

    res.json(message);
  } catch (error: any) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/conversations/find-or-create", async (req: any, res) => {
  try {
    const { caseId, quoteId, customerId, homeownerUserId, contractorUserId, subject, orgId } = req.body;
    const userId = req.user.id;

    const resolvedHomeowner = homeownerUserId || (req.user.role !== "contractor" ? userId : undefined);
    const resolvedContractor = contractorUserId || (req.user.role === "contractor" ? userId : undefined);

    if (!resolvedHomeowner || !resolvedContractor) {
      return res.status(400).json({ error: "Both homeowner and contractor IDs are required" });
    }

    const resolvedOrgId = orgId || req.user.orgId;

    const thread = await storage.findOrCreateThread({
      orgId: resolvedOrgId || '',
      caseId,
      quoteId,
      customerId,
      homeownerUserId: resolvedHomeowner,
      contractorUserId: resolvedContractor,
      subject,
    });

    res.json(thread);
  } catch (error: any) {
    console.error("Error finding/creating thread:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/unread-counts", async (req: any, res) => {
  try {
    const counts = await storage.getUnreadCountsByThread(req.user.id);
    res.json(counts);
  } catch (error: any) {
    console.error("Error fetching unread counts:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/unread-count/case/:caseId", async (req: any, res) => {
  try {
    const count = await storage.getUnreadCountForCase(req.user.id, req.params.caseId);
    res.json({ count });
  } catch (error: any) {
    console.error("Error fetching case unread count:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/conversations/:threadId/read", async (req: any, res) => {
  try {
    await storage.markThreadAsRead(req.params.threadId, req.user.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking thread as read:", error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/conversations/:threadId/stage", async (req: any, res) => {
  try {
    const { stage, quoteId } = req.body;
    if (!stage) return res.status(400).json({ error: "Stage is required" });
    await storage.updateThreadStage(req.params.threadId, stage, quoteId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating thread stage:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
