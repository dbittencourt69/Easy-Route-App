import Link from "next/link";

type ChemistryRow = {
  test: string;
  ideal: string;
  low: string;
  high: string;
  notes: string;
};

const chemistryRows: ChemistryRow[] = [
  {
    test: "Free Chlorine",
    ideal: "2–4 ppm residential; never below 1 ppm",
    low: "Add liquid chlorine or shock. Check CYA, sunlight, algae, and phosphate load.",
    high: "Stop chlorinating. Allow sunlight/time to reduce level. Do not swim until safe.",
    notes: "If CYA/stabilizer is used, keep chlorine higher. Very low chlorine can allow algae/bacteria growth.",
  },
  {
    test: "pH",
    ideal: "7.4–7.6 target; acceptable 7.2–7.8",
    low: "Add pH increaser / soda ash. Circulate and re-test.",
    high: "Add muriatic acid or pH decreaser carefully. Circulate and re-test.",
    notes: "High pH reduces chlorine effectiveness and can cause scaling/cloudiness.",
  },
  {
    test: "Total Alkalinity",
    ideal: "80–120 ppm",
    low: "Add sodium bicarbonate / alkalinity increaser.",
    high: "Lower with acid carefully, then aerate to bring pH back up.",
    notes: "Alkalinity stabilizes pH.",
  },
  {
    test: "Calcium Hardness",
    ideal: "200–400 ppm",
    low: "Add calcium hardness increaser.",
    high: "Partial drain/refill may be needed. Watch for scale.",
    notes: "Very important for plaster pools.",
  },
  {
    test: "Cyanuric Acid / Stabilizer",
    ideal: "30–50 ppm",
    low: "Add stabilizer carefully. Re-test after it dissolves.",
    high: "Partial drain/refill is usually required.",
    notes: "Too much CYA can make chlorine less effective.",
  },
  {
    test: "Salt",
    ideal: "Follow salt-cell manual; commonly 2700–3400 ppm",
    low: "Add pool salt. Brush and circulate until dissolved.",
    high: "Partial drain/refill may be needed.",
    notes: "Always follow the specific salt system display/manual.",
  },
  {
    test: "Combined Chlorine",
    ideal: "0–0.2 ppm",
    low: "No action needed.",
    high: "Shock/oxidize. Check organics, bather load, and filtration.",
    notes: "High combined chlorine can cause odor and irritation.",
  },
  {
    test: "Phosphates",
    ideal: "As low as practical; commonly under 500 ppb",
    low: "No action needed.",
    high: "Use phosphate remover and clean/backwash filter.",
    notes: "Phosphates feed algae, but chlorine balance comes first.",
  },
  {
    test: "TDS",
    ideal: "Varies; watch large increases over source water",
    low: "No action needed.",
    high: "Dilution may be needed if water becomes hard to balance.",
    notes: "Salt pools naturally have higher TDS.",
  },
];

export default function ChemistryReferencePage() {
  return (
    <main className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pool Chemistry Reference</h1>
          <p className="mt-1 text-sm text-gray-600">
            Quick field guide for common pool water test results and corrective actions.
          </p>
        </div>

        <div className="flex gap-4 text-sm">
          <Link className="underline" href="/routes">
            Routes
          </Link>
          <Link className="underline" href="/locations">
            Locations
          </Link>
          <Link className="underline" href="/customers">
            Customers
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
        <b>Important:</b> Always follow product label directions, local regulations,
        customer equipment manuals, and company procedure. Add chemicals carefully,
        circulate, and re-test before making additional adjustments.
      </section>

      <section className="mt-6 overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Test</th>
              <th className="p-3 text-left">Ideal Range</th>
              <th className="p-3 text-left">If Low</th>
              <th className="p-3 text-left">If High</th>
              <th className="p-3 text-left">Notes</th>
            </tr>
          </thead>

          <tbody>
            {chemistryRows.map((row) => (
              <tr key={row.test} className="border-t align-top">
                <td className="p-3 font-medium">{row.test}</td>
                <td className="p-3">{row.ideal}</td>
                <td className="p-3">{row.low}</td>
                <td className="p-3">{row.high}</td>
                <td className="p-3 text-gray-700">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}