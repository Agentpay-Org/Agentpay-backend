import { Router, type Response } from "express";
import { pauseState } from "../store/state.js";

/**
 * Builds the admin router that controls and reports the pause flag.
 */
export function createAdminRouter(): Router {
  const router = Router();

  router.post("/api/v1/admin/pause", (_req, res: Response) => {
    pauseState.paused = true;
    res.json({ paused: pauseState.paused });
  });

  router.post("/api/v1/admin/unpause", (_req, res: Response) => {
    pauseState.paused = false;
    res.json({ paused: pauseState.paused });
  });

  router.get("/api/v1/admin/status", (_req, res: Response) => {
    res.json({ paused: pauseState.paused });
  });

  return router;
}
