/**
 * Deterministic check for the QuoteWorkflowStepper "Shipment Status" row.
 *
 *   cd client && node scripts/verify-stepper-shipment-status.mjs
 *
 * The real component is rendered through react-dom/server, so this asserts on
 * the markup the app produces, not on a copy of the rule. It exits non-zero on
 * the first failing case.
 *
 * The defect it pins down: the Quotation Record modal showed
 * "SHIPMENT: QUOTED" in the header and "Shipment Status: ANALYZED" in the meta
 * bar, because the bar derived a shipment status from the quote status
 * (PENDING_REVIEW -> ANALYZED) while the header read the real one.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, "..");
// An optional argument renders some other build of the component, which is how
// this check is shown to fail on the code it replaces. The file must live in
// src/components/ for its relative imports to resolve.
const component = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(clientRoot, "src/components/QuoteWorkflowStepper.jsx");

// Built inside the client root so the bundle's bare imports (react-dom/server,
// lucide-react) resolve against client/node_modules. Removed again below.
const dir = await mkdtemp(path.join(clientRoot, ".qws-verify-"));

let render;
try {
  const entry = path.join(dir, "entry.jsx");
  await writeFile(
    entry,
    `import { renderToStaticMarkup } from "react-dom/server";
import QuoteWorkflowStepper from ${JSON.stringify(component)};
export function render(props) {
  return renderToStaticMarkup(<QuoteWorkflowStepper {...props} />);
}
`,
  );

  const outfile = path.join(dir, "bundle.mjs");
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    packages: "external",
    loader: { ".css": "empty" },
    logLevel: "error",
    plugins: [
      {
        // The component pulls in the API client, which reads Vite's
        // import.meta.env. Only module-level constants use it; no request is
        // made by importing, so a stub is enough to render.
        name: "vite-env",
        setup(pluginBuild) {
          pluginBuild.onLoad({ filter: /\.(js|jsx)$/ }, async (args) => {
            const source = await readFile(args.path, "utf8");
            if (!source.includes("import.meta.env")) return null;
            return {
              contents: source.replaceAll(
                "import.meta.env",
                '({ VITE_API_BASE_URL: "http://localhost:8000/api" })',
              ),
              loader: args.path.endsWith(".jsx") ? "jsx" : "js",
            };
          });
        },
      },
    ],
  });

  ({ render } = await import(outfile));
} finally {
  await rm(dir, { recursive: true, force: true });
}

// The meta bar renders as: <span ...>Shipment Status:</span><span ...>QUOTED</span>
const SHIP_ROW = /Shipment Status:<\/span>\s*<span[^>]*>([^<]*)</;

function shipmentRow(props) {
  const html = render(props);
  const match = html.match(SHIP_ROW);
  if (!match) throw new Error(`meta bar did not render for ${JSON.stringify(props)}`);
  return match[1].trim();
}

const M4 = { status: "PENDING_CUSTOMS_REVIEW", companyName: "Maersk Line" };
const M4_APPROVED = { status: "APPROVED", companyName: "Maersk Line" };

const cases = [
  {
    name: "QUOTED shipment wins over the PENDING_REVIEW derivation (the reported defect)",
    props: { status: "PENDING_REVIEW", m4: null, shipmentStatus: "QUOTED" },
    expected: "QUOTED",
  },
  {
    name: "QUOTED shipment wins inside the M4 company workflow too",
    props: { status: "PENDING_REVIEW", m4: M4, shipmentStatus: "QUOTED" },
    expected: "QUOTED",
  },
  {
    name: "no shipmentStatus supplied keeps the previous derivation",
    props: { status: "PENDING_REVIEW", m4: null },
    expected: "ANALYZED",
  },
  {
    name: "an M4 quote with no shipmentStatus keeps its M4 stages and derivation",
    props: { status: "PENDING_REVIEW", m4: M4_APPROVED },
    expected: "ANALYZED",
  },
  {
    name: "other quote statuses keep their previous derivation",
    props: { status: "APPROVED", m4: null },
    expected: "QUOTED",
  },
  {
    name: "null shipmentStatus falls back instead of blanking the row",
    props: { status: "PENDING_REVIEW", m4: null, shipmentStatus: null },
    expected: "ANALYZED",
  },
  {
    name: "empty shipmentStatus falls back instead of blanking the row",
    props: { status: "PENDING_REVIEW", m4: null, shipmentStatus: "" },
    expected: "ANALYZED",
  },
  {
    name: "a real shipment status is normalised before display",
    props: { status: "PENDING_REVIEW", m4: null, shipmentStatus: "quote_issued" },
    expected: "QUOTED",
  },
  {
    name: "a closed shipment reads CLOSED",
    props: { status: "SENT", m4: null, shipmentStatus: "BOOKED" },
    expected: "CLOSED",
  },
  {
    // mapApiQuote stores the derivation when the API sends no shipment status,
    // so this value arrives here pre-derived. Normalising it must be a no-op.
    name: "an already-canonical shipment status is unchanged",
    props: { status: "PENDING_REVIEW", m4: null, shipmentStatus: "ANALYZED" },
    expected: "ANALYZED",
  },
];

const failures = [];
for (const { name, props, expected } of cases) {
  const actual = shipmentRow(props);
  const ok = actual === expected;
  if (!ok) failures.push(`${name}: expected "${expected}", got "${actual}"`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} -> Shipment Status: ${actual}`);
}

// Steps must not move: the same props with and without a shipment status have
// to render identical markup apart from the ship pill's own value.
const stripShipValue = (html) =>
  html.replace(SHIP_ROW, 'Shipment Status:</span><span class="qws-meta-val ship-pill">*</span>');

for (const base of [
  { status: "PENDING_REVIEW", m4: null },
  { status: "PENDING_REVIEW", m4: M4 },
  { status: "ACCEPTED", m4: null },
]) {
  const without = stripShipValue(render(base));
  const withReal = stripShipValue(render({ ...base, shipmentStatus: "QUOTED" }));
  const ok = without === withReal;
  const label = `stages unchanged by shipmentStatus (${base.m4 ? "M4 " : ""}${base.status})`;
  if (!ok) failures.push(`${label}: rendered steps differ`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

if (failures.length) {
  console.error(`\n${failures.length} of ${cases.length + 3} checks failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\nAll ${cases.length + 3} checks passed.`);
