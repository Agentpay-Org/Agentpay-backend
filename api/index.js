// Vercel serverless entrypoint: exports the Express app without listening.
import { app } from "../dist/index.js";

export default app;
