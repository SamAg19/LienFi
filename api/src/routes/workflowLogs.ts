import { Router, Request, Response } from "express";

const router = Router();

// In-memory log store — keyed by requestHash
const logStore: Record<string, Array<{
  line: string;
  timestamp: number;
}>> = {};

/**
 * POST /workflow-logs
 * Receives raw log lines from the CRE wrapper script.
 * Body: { requestHash, line } or { requestHash, lines: string[] }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { requestHash, line, lines } = req.body;

    if (!requestHash) {
      return res.status(400).json({ error: "requestHash is required" });
    }

    if (!logStore[requestHash]) logStore[requestHash] = [];

    if (lines && Array.isArray(lines)) {
      for (const l of lines) {
        logStore[requestHash].push({ line: l, timestamp: Date.now() });
      }
    } else if (line) {
      logStore[requestHash].push({ line, timestamp: Date.now() });
    } else {
      return res.status(400).json({ error: "line or lines required" });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /workflow-logs/:requestHash
 * Frontend polls this to get raw CRE output.
 * Optional ?after=<timestamp> to only get new lines.
 */
router.get("/:requestHash", async (req: Request, res: Response) => {
  try {
    const requestHash = req.params.requestHash as string;
    const after = parseInt(req.query.after as string) || 0;
    const all = logStore[requestHash] || [];
    const logs = after ? all.filter((l) => l.timestamp > after) : all;
    return res.json({ logs, total: all.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
