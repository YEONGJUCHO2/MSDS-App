import { loadEnvFile } from "./env";

loadEnvFile();

const { app } = await import("./app");

const port = Number(process.env.PORT ?? 8787);

app.listen(port, () => {
  console.log(`MSDS Watcher API listening on http://localhost:${port}`);
});
