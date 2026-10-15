import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) loadEnvFile(".env");

const port = Number(process.env.API_PORT ?? process.env.PORT ?? "8787");
const hostname = process.env.HOST ?? "127.0.0.1";
if (!["127.0.0.1", "localhost", "::1"].includes(hostname) && !(process.env.DEMO_MODE === "true" && process.env.ALLOW_PUBLIC_DEMO === "true")) throw new Error("Public binding requires DEMO_MODE=true and ALLOW_PUBLIC_DEMO=true. Only synthetic demo data is supported.");
const { app, close } = createApp();
const server = serve({ fetch: app.fetch, port, hostname }, (info) => console.log(`Synthetic clinical API ready at http://${hostname}:${info.port}`));
const stop = () => server.close(() => { close(); process.exit(0); });
process.on("SIGTERM", stop); process.on("SIGINT", stop);
