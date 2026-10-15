import { serve } from "@hono/node-server";
import { createHospitalApp } from "./app";

const hospitalId = process.env.HOSPITAL_ID;
if (hospitalId !== "A" && hospitalId !== "B") throw new Error("HOSPITAL_ID must be A or B.");
const hostname = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.HOSPITAL_PORT ?? process.env.PORT ?? (hospitalId === "A" ? "8791" : "8792"));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("HOSPITAL_PORT_INVALID");
const { app, close } = createHospitalApp({ hospitalId, host: hostname });
const server = serve({ fetch: app.fetch, hostname, port }, () => console.log(`Synthetic hospital ${hospitalId} API listening on port ${port}`));
const stop = () => server.close(() => { close(); process.exit(0); });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
