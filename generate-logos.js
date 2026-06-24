const sharp = require("sharp");
const path  = require("path");
const fs    = require("fs");

// PivotOps logo SVG — chrome double triangle
const sizes = [
  { name: "pivotops-logo-1080x1080", w: 1080, h: 1080 }, // Instagram / Facebook
  { name: "pivotops-logo-800x800",   w: 800,  h: 800  }, // LinkedIn profile
  { name: "pivotops-logo-400x400",   w: 400,  h: 400  }, // Twitter/X profile
  { name: "pivotops-logo-200x200",   w: 200,  h: 200  }, // Favicon source
];

const padding = 0.2; // 20% padding around logo

async function generate(size) {
  const logoSize  = Math.round(size.w * (1 - padding * 2));
  const offset    = Math.round(size.w * padding);
  const logoH     = Math.round(logoSize * 0.87);
  const offsetY   = Math.round((size.h - logoH) / 2);

  const svg = `<svg width="${size.w}" height="${size.h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size.w}" height="${size.h}" fill="#080810"/>
  <defs>
    <linearGradient id="co" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#d0d0d0"/>
      <stop offset="35%"  stop-color="#ffffff"/>
      <stop offset="65%"  stop-color="#909090"/>
      <stop offset="100%" stop-color="#b8b8b8"/>
    </linearGradient>
    <linearGradient id="ci" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#606060"/>
      <stop offset="50%"  stop-color="#c8c8c8"/>
      <stop offset="100%" stop-color="#484848"/>
    </linearGradient>
  </defs>
  <g transform="translate(${offset}, ${offsetY}) scale(${logoSize / 100})">
    <path d="M50 3L97 84H3L50 3Z"
      fill="rgba(255,255,255,0.03)"
      stroke="url(#co)"
      stroke-width="4"
      stroke-linejoin="round"/>
    <path d="M50 24L80 75H20L50 24Z"
      fill="none"
      stroke="url(#ci)"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-opacity="0.7"/>
  </g>
</svg>`;

  const outDir = path.join(__dirname, "public", "brand");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  await sharp(Buffer.from(svg))
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, `${size.name}.png`));

  console.log(`✅ Generated: ${size.name}.png (${size.w}x${size.h})`);
}

(async () => {
  for (const size of sizes) {
    await generate(size);
  }
  console.log("\n✅ All logo sizes generated in public/brand/");
})();