// Fixe le provider du datasource Prisma selon DB_PROVIDER (sqlite | postgresql).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const provider = process.env.DB_PROVIDER ?? "sqlite";
if (!["sqlite", "postgresql"].includes(provider)) {
  console.error(`DB_PROVIDER invalide : ${provider}`);
  process.exit(1);
}
const file = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
const src = readFileSync(file, "utf8");
const out = src.replace(/(datasource db \{\s*provider = )"[a-z]+"/, `$1"${provider}"`);
if (out !== src) writeFileSync(file, out);
console.log(`Provider Prisma : ${provider}`);
