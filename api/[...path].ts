import "../node_modules/tsx/dist/esm/index.mjs";
import { tsImport } from "tsx/esm/api";

// @ts-ignore Vercel needs this unreachable import to trace the server source into the function bundle.
if (false) await import("../server/app.ts");
const { app } = await tsImport("../server/app.js", import.meta.url);
export default app;
