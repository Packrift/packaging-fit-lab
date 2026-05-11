import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const graphPath = "/Users/farhan/Downloads/packrift-ai-commerce-factory/control/product_spec_graph_current.csv";
const feedPath = "/Users/farhan/Downloads/packrift-ai-commerce-execution-2026-05-04/ai-catalog-control/merchant-top1000/merchant-center-top1000-exact-spec-feed-2026-05-05.jsonl";
const outPath = path.join(root, "docs/data/packrift-package-library.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...data] = rows;
  return data
    .filter((r) => r.some((value) => String(value || "").trim()))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ""])));
}

function number(value) {
  const n = Number(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detailMap(details = []) {
  const out = {};
  for (const detail of details) {
    const key = String(detail.attributeName || "").toLowerCase();
    if (key) out[key] = String(detail.attributeValue || "").trim();
  }
  return out;
}

function scoreRow(row) {
  const rank = number(row.top250_rank) || 9999;
  const volume = number(row.title_length_in) * number(row.title_width_in) * number(row.title_height_in);
  return rank + Math.log10(Math.max(volume, 1));
}

function laborDelta(family, volume) {
  if (family === "mailers") return volume > 500 ? -2 : -4;
  if (volume > 3200) return 5;
  if (volume > 1600) return 3;
  if (volume > 700) return 2;
  return 0;
}

function main() {
  const feedRows = fs.readFileSync(feedPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const feedByOffer = new Map(feedRows.map((row) => [row.offerId, row]));
  const graphRows = parseCsv(fs.readFileSync(graphPath, "utf8"));

  const candidates = graphRows
    .map((row) => {
      const feed = feedByOffer.get(row.offer_id);
      const attrs = feed?.productAttributes || {};
      const details = detailMap(attrs.productDetails || []);
      const family = row.family;
      const l = number(row.metafield_length_in || row.title_length_in);
      const w = number(row.metafield_width_in || row.title_width_in);
      const h = number(row.metafield_height_in || row.title_height_in);
      const price = number(row.price);
      const packCount = number(attrs.unitPricingMeasure?.value) || number(String(row.title).match(/(?:bundle|pack|case|carton|roll) of (\d+)|(\d+)\s*(?:pack|count|ct|bundle|case)/i)?.[1] || String(row.title).match(/(?:bundle|pack|case|carton|roll) of (\d+)|(\d+)\s*(?:pack|count|ct|bundle|case)/i)?.[2]);
      const volume = l && w && h ? l * w * h : null;
      if (!["boxes", "mailers"].includes(family) || !l || !w || !h || !price || !packCount || !row.handle) return null;
      const material = price / packCount;
      return {
        sku: row.sku,
        name: row.title,
        type: family === "mailers" ? "Mailer" : "Box",
        family,
        l,
        w,
        h,
        weight: number(row.weight_value),
        material: Number(material.toFixed(4)),
        priceSnapshot: price,
        packCount,
        laborDelta: laborDelta(family, volume),
        url: `https://packrift.com/products/${row.handle}`,
        variantUrl: `https://packrift.com/products/${row.handle}?variant=${encodeURIComponent(row.variant_id || "")}`,
        image: row.primary_image_url,
        materialSignal: details.material || "",
        source: "Packrift exact-spec feed and product spec graph snapshot",
        score: scoreRow(row),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  const byDimension = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.family}:${candidate.l}:${candidate.w}:${candidate.h}`;
    if (!byDimension.has(key)) byDimension.set(key, candidate);
  }

  const balanced = [...byDimension.values()]
    .filter((item) => item.l <= 36 && item.w <= 30 && item.h <= 24)
    .slice(0, 160)
    .map(({ score, ...item }) => item);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceRows: candidates.length,
    publishedRows: balanced.length,
    caveat: "Static Packrift source snapshot. Verify live price, inventory, freight, and fit approval on Packrift.com.",
    packages: balanced,
  }, null, 2)}\n`);
  console.log(JSON.stringify({ sourceRows: candidates.length, publishedRows: balanced.length, outPath }, null, 2));
}

main();
