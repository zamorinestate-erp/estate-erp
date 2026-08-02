// PAGE: Cafe Performance (Owner Portal) — Part F.2 / Part G.4
const CAFES = [
  { name: "Dawn Roast — Koramangala", sales: 428000, labour: 22, variance: 850 },
  { name: "Indiranagar", sales: 512000, labour: 19, variance: 120 },
  { name: "Koramangala Central", sales: 379000, labour: 25, variance: -240 },
];

export function renderPerformance() {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Cafe Performance</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">This month, across your cafes</div>
      <div class="glass" style="padding:22px;">
        <table class="glass-table">
          <thead><tr><th>Cafe</th><th>Sales (MTD)</th><th>Labour %</th><th>Cash variance</th></tr></thead>
          <tbody>
            ${CAFES.map(
              (c) => `
              <tr>
                <td>${c.name}</td>
                <td>₹${c.sales.toLocaleString("en-IN")}</td>
                <td>${c.labour}%</td>
                <td style="color:${c.variance < 0 ? "#FF9E8F" : "var(--color-accent-mint-bright)"};">${c.variance < 0 ? "-" : "+"}₹${Math.abs(c.variance)}</td>
              </tr>`
            ).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
