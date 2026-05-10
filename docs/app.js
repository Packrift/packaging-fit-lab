const $ = (id) => document.getElementById(id);

const fields = [
  "itemLength", "itemWidth", "itemHeight", "itemWeight",
  "currentLength", "currentWidth", "currentHeight", "currentMaterial",
  "monthlyOrders", "laborSeconds", "laborRate", "consumables",
  "dimDivisor", "billableRate", "clearance", "riskCost"
];

const presets = {
  apparel: {
    itemLength: 11, itemWidth: 8, itemHeight: 1.5, itemWeight: 1.1,
    currentLength: 14, currentWidth: 10, currentHeight: 4, currentMaterial: 0.78,
    monthlyOrders: 4200, laborSeconds: 24, laborRate: 23, consumables: 0.12,
    dimDivisor: 139, billableRate: 0.16, clearance: 0.4, riskCost: 0.04
  },
  parts: {
    itemLength: 5, itemWidth: 4, itemHeight: 3, itemWeight: 2.4,
    currentLength: 10, currentWidth: 8, currentHeight: 6, currentMaterial: 0.86,
    monthlyOrders: 1800, laborSeconds: 36, laborRate: 24, consumables: 0.22,
    dimDivisor: 139, billableRate: 0.22, clearance: 0.5, riskCost: 0.08
  },
  cosmetics: {
    itemLength: 6, itemWidth: 3, itemHeight: 2, itemWeight: 0.8,
    currentLength: 9, currentWidth: 6, currentHeight: 4, currentMaterial: 0.62,
    monthlyOrders: 6500, laborSeconds: 20, laborRate: 21, consumables: 0.1,
    dimDivisor: 139, billableRate: 0.15, clearance: 0.35, riskCost: 0.05
  }
};

const packageLibrary = [
  { name: "Rigid mailer 9 x 6 x 1", type: "Mailer", l: 9, w: 6, h: 1, material: 0.34, laborDelta: -5 },
  { name: "Bubble mailer 10 x 13 x 1.5", type: "Mailer", l: 10, w: 13, h: 1.5, material: 0.39, laborDelta: -4 },
  { name: "Carton 6 x 4 x 4", type: "Box", l: 6, w: 4, h: 4, material: 0.41, laborDelta: 0 },
  { name: "Carton 8 x 6 x 4", type: "Box", l: 8, w: 6, h: 4, material: 0.49, laborDelta: 0 },
  { name: "Carton 10 x 6 x 6", type: "Box", l: 10, w: 6, h: 6, material: 0.58, laborDelta: 1 },
  { name: "Carton 12 x 9 x 4", type: "Box", l: 12, w: 9, h: 4, material: 0.72, laborDelta: 1 },
  { name: "Carton 12 x 10 x 8", type: "Box", l: 12, w: 10, h: 8, material: 0.86, laborDelta: 2 },
  { name: "Carton 14 x 10 x 6", type: "Box", l: 14, w: 10, h: 6, material: 0.92, laborDelta: 2 },
  { name: "Carton 16 x 12 x 8", type: "Box", l: 16, w: 12, h: 8, material: 1.18, laborDelta: 3 },
  { name: "Carton 18 x 14 x 10", type: "Box", l: 18, w: 14, h: 10, material: 1.47, laborDelta: 4 },
  { name: "Carton 24 x 18 x 12", type: "Box", l: 24, w: 18, h: 12, material: 2.2, laborDelta: 6 }
];

function number(id) {
  return Math.max(0, Number($(id).value) || 0);
}

function inputState() {
  return Object.fromEntries(fields.map((field) => [field, number(field)]));
}

function volume(pkg) {
  return pkg.l * pkg.w * pkg.h;
}

function dimsFit(item, pkg, clearance) {
  const itemDims = [item.l + clearance, item.w + clearance, item.h + clearance].sort((a, b) => b - a);
  const pkgDims = [pkg.l, pkg.w, pkg.h].sort((a, b) => b - a);
  return itemDims.every((dim, index) => dim <= pkgDims[index]);
}

function dimWeight(pkg, divisor) {
  if (!divisor) return 0;
  return Math.ceil(volume(pkg) / divisor);
}

function utilization(item, pkg) {
  if (!volume(pkg)) return 0;
  return Math.min(100, (volume(item) / volume(pkg)) * 100);
}

function money(value) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function decimal(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.0";
}

function candidateCost(candidate, state, item) {
  const billable = Math.max(item.weight, dimWeight(candidate, state.dimDivisor));
  const laborSeconds = Math.max(0, state.laborSeconds + (candidate.laborDelta || 0));
  const labor = (laborSeconds / 3600) * state.laborRate;
  const voidFill = Math.max(0, (100 - utilization(item, candidate)) / 100) * state.consumables;
  const dimProxy = billable * state.billableRate;
  const risk = utilization(item, candidate) > 88 ? state.riskCost * 1.4 : state.riskCost;
  return candidate.material + labor + voidFill + dimProxy + risk;
}

function buildModel() {
  const state = inputState();
  const item = {
    l: state.itemLength,
    w: state.itemWidth,
    h: state.itemHeight,
    weight: state.itemWeight
  };
  const current = {
    name: "Current package",
    type: "Current",
    l: state.currentLength,
    w: state.currentWidth,
    h: state.currentHeight,
    material: state.currentMaterial,
    laborDelta: 0
  };

  const currentCost = candidateCost(current, state, item);
  const candidates = packageLibrary
    .filter((pkg) => dimsFit(item, pkg, state.clearance))
    .map((pkg) => {
      const cost = candidateCost(pkg, state, item);
      const billable = Math.max(item.weight, dimWeight(pkg, state.dimDivisor));
      return {
        ...pkg,
        utilization: utilization(item, pkg),
        dimWeight: dimWeight(pkg, state.dimDivisor),
        billable,
        cost,
        annualDelta: (currentCost - cost) * state.monthlyOrders * 12
      };
    })
    .sort((a, b) => b.annualDelta - a.annualDelta || b.utilization - a.utilization);

  const best = candidates[0] || { ...current, utilization: utilization(item, current), dimWeight: dimWeight(current, state.dimDivisor), billable: Math.max(item.weight, dimWeight(current, state.dimDivisor)), cost: currentCost, annualDelta: 0 };
  return {
    state,
    item,
    current: {
      ...current,
      utilization: utilization(item, current),
      dimWeight: dimWeight(current, state.dimDivisor),
      billable: Math.max(item.weight, dimWeight(current, state.dimDivisor)),
      cost: currentCost
    },
    candidates,
    best
  };
}

function renderVisual(model) {
  const svg = $("boxVisual");
  const current = model.current;
  const best = model.best;
  const currentScale = Math.min(1, 180 / Math.max(current.l, current.w, current.h, 1));
  const bestScale = Math.min(1, 180 / Math.max(best.l, best.w, best.h, 1));
  const itemScale = Math.min(currentScale, bestScale);

  const cube = (x, y, pkg, scale, fill, label) => {
    const width = Math.max(32, pkg.l * scale * 10);
    const height = Math.max(26, pkg.h * scale * 10);
    const depth = Math.max(14, pkg.w * scale * 4);
    const util = decimal(pkg.utilization, 0);
    return `
      <g transform="translate(${x},${y})">
        <polygon points="${depth},0 ${width + depth},0 ${width},${depth} 0,${depth}" fill="${fill}" opacity="0.7"></polygon>
        <rect x="0" y="${depth}" width="${width}" height="${height}" fill="${fill}" opacity="0.9"></rect>
        <polygon points="${width},${depth} ${width + depth},0 ${width + depth},${height} ${width},${height + depth}" fill="${fill}" opacity="0.55"></polygon>
        <rect x="${width * 0.3}" y="${depth + height * 0.35}" width="${Math.max(24, model.item.l * itemScale * 8)}" height="${Math.max(14, model.item.h * itemScale * 8)}" rx="3" fill="#ffffff" opacity="0.9"></rect>
        <text x="0" y="${height + depth + 28}" fill="#18211f" font-size="16" font-weight="700">${label}</text>
        <text x="0" y="${height + depth + 50}" fill="#65716d" font-size="13">${pkg.l} x ${pkg.w} x ${pkg.h} in · ${util}% utilized</text>
      </g>
    `;
  };

  svg.innerHTML = `
    <rect width="640" height="320" fill="transparent"></rect>
    ${cube(58, 62, current, currentScale, "#b27613", "Current")}
    ${cube(360, 62, best, bestScale, "#1f7a4d", "Recommended")}
    <line x1="310" y1="48" x2="310" y2="270" stroke="#d7dfdb" stroke-width="2" stroke-dasharray="6 8"></line>
  `;
}

function renderTiles(model) {
  const current = model.current;
  const best = model.best;
  const cubeDrop = ((volume(current) - volume(best)) / Math.max(volume(current), 1)) * 100;
  const dimDrop = current.dimWeight - best.dimWeight;
  const perOrder = current.cost - best.cost;
  const annual = perOrder * model.state.monthlyOrders * 12;
  const utilShift = best.utilization - current.utilization;
  const tiles = [
    ["Per-order impact", money(perOrder), "Estimated planning difference per order"],
    ["Cube reduction", `${decimal(cubeDrop, 0)}%`, "Lower package volume vs current"],
    ["DIM lb change", `${decimal(dimDrop, 0)} lb`, "Difference in calculated DIM weight"],
    ["Utilization lift", `${decimal(utilShift, 0)} pts`, "More product volume inside the package"]
  ];
  $("metricTiles").innerHTML = tiles.map(([label, value, helper]) => `
    <div class="tile">
      <span>${label}</span>
      <strong>${value}</strong>
      <span>${helper}</span>
    </div>
  `).join("");
  $("annualSavings").textContent = money(annual);
}

function renderCandidates(model) {
  const rows = model.candidates.slice(0, 7).map((pkg, index) => `
    <div class="candidate-row ${index === 0 ? "best" : ""}">
      <strong>${pkg.name}</strong>
      <span>${decimal(pkg.utilization, 0)}% fit</span>
      <span>${decimal(pkg.billable, 1)} lb billable</span>
      <div>
        <div class="bar"><span style="width:${Math.max(4, Math.min(100, pkg.utilization))}%"></span></div>
      </div>
    </div>
  `);
  $("candidateTable").innerHTML = rows.length ? rows.join("") : `<p>No library package fits this product with the current clearance. Reduce the clearance or use a custom carton.</p>`;
}

function renderNotes(model) {
  const notes = [];
  const best = model.best;
  const current = model.current;
  if (best.name === "Current package") {
    notes.push("No smaller library package outperformed the current package with these assumptions.");
  } else {
    notes.push(`${best.name} is the strongest candidate under the current cost and fit assumptions.`);
  }
  if (current.dimWeight > model.item.weight) {
    notes.push("The current package is DIM-weight sensitive; lowering cube can matter even when material cost is similar.");
  }
  if (best.utilization > 88) {
    notes.push("The recommendation is a tight fit. Validate with samples, dunnage, product tolerance, and damage testing before switching.");
  }
  if (model.state.monthlyOrders > 3000) {
    notes.push("At this order volume, small per-order changes can compound into meaningful annual impact.");
  }
  notes.push("Rates are proxies, not carrier quotes. Replace the defaults with your own material, labor, and carrier agreement numbers.");
  $("planningNotes").innerHTML = notes.map((note) => `<li>${note}</li>`).join("");
}

function render() {
  const model = buildModel();
  $("bestName").textContent = model.best.name;
  $("bestReason").textContent = `${model.best.type || "Package"} · ${decimal(model.best.utilization, 0)}% utilization · ${decimal(model.best.billable, 1)} lb billable-weight proxy · ${money(model.best.cost)} estimated cost/order.`;
  renderVisual(model);
  renderTiles(model);
  renderCandidates(model);
  renderNotes(model);
  return model;
}

function applyPreset(name) {
  const preset = presets[name];
  Object.entries(preset).forEach(([field, value]) => {
    $(field).value = value;
  });
  render();
}

function stateQuery() {
  const params = new URLSearchParams();
  for (const field of fields) params.set(field, $(field).value);
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

function hydrateFromQuery() {
  const params = new URLSearchParams(location.search);
  for (const field of fields) {
    if (params.has(field)) $(field).value = params.get(field);
  }
}

function downloadCsv() {
  const model = buildModel();
  const rows = [
    ["package", "length", "width", "height", "utilization_percent", "dim_weight_lb", "billable_weight_lb", "estimated_cost_per_order", "annual_delta"],
    ["Current package", model.current.l, model.current.w, model.current.h, decimal(model.current.utilization), model.current.dimWeight, decimal(model.current.billable), decimal(model.current.cost, 2), "0"],
    ...model.candidates.map((pkg) => [pkg.name, pkg.l, pkg.w, pkg.h, decimal(pkg.utilization), pkg.dimWeight, decimal(pkg.billable), decimal(pkg.cost, 2), decimal(pkg.annualDelta, 2)])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "packrift-packaging-fit-lab.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

hydrateFromQuery();
fields.forEach((field) => $(field).addEventListener("input", render));
document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
$("downloadCsv").addEventListener("click", downloadCsv);
$("copyLink").addEventListener("click", async () => {
  const link = stateQuery();
  if (navigator.clipboard) await navigator.clipboard.writeText(link);
  history.replaceState(null, "", link);
  $("copyLink").textContent = "Copied";
  setTimeout(() => { $("copyLink").textContent = "Copy"; }, 1400);
});
$("resetTool").addEventListener("click", () => {
  applyPreset("parts");
  history.replaceState(null, "", location.pathname);
});
render();

