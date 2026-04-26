import "../node_modules/tsx/dist/esm/index.mjs";
import { tsImport } from "tsx/esm/api";

const { app } = await tsImport("../server/app.ts", import.meta.url);
export default app;
