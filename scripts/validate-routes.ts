import fs from "fs";
import path from "path";

const appDir = path.join(process.cwd(), "app/dashboard");

function scanRoutes(dir: string, baseRoute = "/dashboard") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  let routes: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      routes = routes.concat(scanRoutes(fullPath, baseRoute));
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      const route = fullPath
        .replace(appDir, baseRoute)
        .replace("/page.tsx", "")
        .replace(/\\/g, "/");

      routes.push(route || baseRoute);
    }
  }

  return routes;
}

const routes = scanRoutes(appDir);

console.log("🧭 Registered Routes:");
console.table(routes);

// Fail build if critical route missing
const requiredRoutes = [
  "/dashboard/recruitment",
  "/dashboard/teams",
  "/dashboard/voice",
  "/dashboard/profiles",
];

const missing = requiredRoutes.filter((r) => !routes.includes(r));

if (missing.length) {
  console.error("❌ Missing Routes:", missing);
  process.exit(1);
}

console.log("✅ All routes valid");