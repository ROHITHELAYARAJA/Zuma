import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
if (existsSync(".env")) loadEnvFile(".env");
process.env.HOSPITAL_ID = process.argv[2];
process.env.HOSPITAL_PORT = process.argv[2] === "A" ? "8791" : "8792";
await import("./index");
