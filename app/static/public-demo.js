/* GitHub Pages transport: deterministic fixtures, browser-local state, no server. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const fixtures = nativeFetch(new URL('static/demo.json', document.baseURI)).then(r => {
    if (!r.ok) throw new Error('Demo fixtures could not be loaded.');
    return r.json();
  });
  const key = 'airs-public-runs-v1';
  let runs;
  function readRuns() {
    try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(saved) ? saved : []; }
    catch { return []; }
  }
  function saveRuns(next) {
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { throw new Error('Browser storage is full or unavailable. Export your runs or allow site storage and retry.'); }
    runs = next;
  }
  function response(data, status = 200) {
    return new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json'}});
  }
  window.fetch = async (path, options = {}) => {
    if (typeof path !== 'string' || !path.startsWith('/api/')) return nativeFetch(path, options);
    try {
      const data = await fixtures;
      runs ??= readRuns();
      const body = options.body ? JSON.parse(options.body) : {};
      if (path === '/api/dataset') return response(data.dataset);
      if (path === '/api/config') return response({live_available:false});
      if (path === '/api/runs' && options.method !== 'POST') return response(runs);
      if (path === '/api/runs') {
        if (body.mode && body.mode !== 'demo') throw new Error('Live evaluation is available only in the self-hosted app.');
        const models = body.models || data.run.summaries.map(s => s.model);
        if (!models.length || new Set(models).size !== models.length || models.some(m => !data.run.summaries.some(s => s.model === m))) throw new Error('Choose valid, distinct demo models.');
        const run = {...JSON.parse(JSON.stringify(data.run)), id:crypto.randomUUID(), created:new Date().toISOString()};
        run.summaries = run.summaries.filter(s => models.includes(s.model));
        run.results = run.results.filter(r => models.includes(r.model));
        saveRuns([run, ...runs].slice(0, 30));
        return response(run);
      }
      if (path === '/api/compare') {
        const ids = body.run_ids || [];
        if (ids.length < 2 || ids.length > 6 || new Set(ids).size !== ids.length) throw new Error('Select 2–6 distinct runs.');
        const selected = ids.map(id => runs.find(r => r.id === id));
        if (selected.some(r => !r)) throw new Error('Run not found.');
        const baseline = selected[0], model = baseline.summaries[0];
        if (selected.some(r => r.dataset_hash !== baseline.dataset_hash || r.evaluator_version !== baseline.evaluator_version || r.mode !== baseline.mode)) throw new Error('Select compatible runs.');
        const before = baseline.results.filter(r => r.model === model.model);
        const rows = selected.flatMap(run => run.summaries.map(summary => {
          const after = run.results.filter(r => r.model === summary.model);
          if (after.length !== before.length || before.some(b => !after.some(a => a.case_id === b.case_id))) throw new Error('Runs must contain identical case IDs.');
          const changes = passed => after.filter(a => a.passed === passed && before.some(b => b.case_id === a.case_id && b.passed !== passed)).map(a => a.case_id);
          return {...summary, run_id:run.id, created:run.created, delta_pp:Math.round((summary.score-model.score)*10)/10, regressions:changes(false), improvements:changes(true)};
        }));
        return response({baseline_run:baseline.id, baseline_model:model.model, rows, note:'Descriptive paired case changes only; not a statistical significance test.'});
      }
      if (path === '/api/feedback') {
        if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || typeof body.comment !== 'string' || body.comment.length < 3 || body.comment.length > 2000) throw new Error('Enter a rating and a comment of 3–2000 characters.');
        const feedback = JSON.parse(localStorage.getItem('airs-public-feedback-v1') || '[]');
        localStorage.setItem('airs-public-feedback-v1', JSON.stringify([...feedback, {...body, created:new Date().toISOString()}].slice(-50)));
        return response({saved:true}, 201);
      }
      return response({detail:'Not available in the public demo.'}, 404);
    } catch (error) { return response({detail:error.message}, 400); }
  };
})();
