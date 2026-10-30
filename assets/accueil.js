/* Published world data only: never fabricate a live cycle or a current count. */
(async () => {
  const status = document.getElementById('vie');
  try {
    const [inst, jeux] = await Promise.all(['instantane.json', 'jeux.json'].map(name =>
      fetch('mondes/orvane/' + name, { cache: 'no-cache' })
        .then(r => r.ok ? r.json() : null).catch(() => null)));
    if (!inst || !inst.cycle || inst.cycle.n == null) {
      status.textContent = 'État courant disponible dans l’Observatoire';
      return;
    }
    const parts = ['Cycle ' + inst.cycle.n];
    const season = inst.cycle.saison && inst.cycle.saison.nom;
    if (typeof season === 'string') parts.push(season);
    if (Array.isArray(jeux)) {
      const n = jeux.filter(j => j.actif !== false).length;
      parts.push(n + (n === 1 ? ' jeu branché' : ' jeux branchés'));
    }
    status.textContent = parts.join(' · ');
    if (Array.isArray(inst.taxons)) {
      document.getElementById('lignees').textContent = String(inst.taxons.filter(t => t.eteint == null).length);
      document.getElementById('lignees-label').textContent = 'lignées vivantes à ce cycle';
    }
  } catch (_) {
    status.textContent = 'État courant disponible dans l’Observatoire';
  }
})();
