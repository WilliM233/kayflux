registerView('divisions', async (container) => {
  const [data, brands] = await Promise.all([api('/divisions'), api('/brands')]);

  // Brand column order driven by brand_rank (excludes Cross-Brand)
  const brandOrder = brands.filter(b => b.id !== 4).map(b => b.name);
  const brandIdMap = {};
  for (const b of brands) brandIdMap[b.name] = b.id;
  const divOrder = ["Men's World", "Women's World", "Men's Midcard", "Women's Midcard", "Men's Tag", "Women's Tag"];

  container.innerHTML = `
    <div class="view-header">
      <h2>Divisions</h2>
    </div>
    <div class="divisions-grid">
      ${brandOrder.map(brand => {
        const divisions = data[brand];
        if (!divisions) return '';
        const cls = brand.toLowerCase().replace(/\s/g, '');
        return `
          <div class="brand-column">
            <div class="brand-column-header ${cls} clickable-row" onclick="navigate('brand-hub', {brandId: ${brandIdMap[brand]}})" style="cursor:pointer">${brand} <span style="opacity:0.5; font-size:0.8em">&#8250;</span></div>
            ${divOrder.map(div => {
              const superstars = divisions[div];
              if (!superstars || superstars.length === 0) return '';
              return `
                <div class="division-section">
                  <div class="division-title">${esc(div)} (${superstars.length})</div>
                  <ul class="ranked-list">
                    ${superstars.map(s => `
                      <li class="ranked-item clickable-row ${s.division_rank === 0 ? 'champion' : ''}" onclick="navigate('notes', {type:'superstars', id:${s.id}})">
                        <span class="rank-number ${s.division_rank === 0 ? 'champion-rank' : ''}">${s.division_rank === 0 ? 'C' : s.division_rank}</span>
                        <span class="superstar-name">${esc(s.name)}</span>
                        ${s.alignment ? alignmentBadge(s.alignment) : ''}
                        <span class="rating">${s.overall_rating || ''}</span>
                        ${s.total_matches > 0 ? `<span class="rating">${s.wins}-${s.losses}-${s.draws}</span>` : ''}
                      </li>
                    `).join('')}
                  </ul>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `;
});
