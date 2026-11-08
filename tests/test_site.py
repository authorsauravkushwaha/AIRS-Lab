import json
from pathlib import Path
from scripts.build_site import build

ROOT = Path(__file__).resolve().parents[1]


def test_pages_workflow_deploys_default_branch():
    """The github-pages environment and Pages source both allow main only.

    Triggering on a hardcoded arena/* branch silently never publishes.
    """
    workflow = (ROOT / '.github/workflows/pages.yml').read_text(encoding='utf-8')
    assert 'branches: [main]' in workflow
    assert 'arena/' not in workflow
    assert 'workflow_dispatch' in workflow
    assert 'actions/deploy-pages' in workflow


def test_public_site_build(tmp_path, monkeypatch):
    monkeypatch.setenv('AIRS_DB', 'preserved.sqlite3')
    build(tmp_path)
    html = (tmp_path / 'index.html').read_text(encoding='utf-8')
    assert 'src="./static/public-demo.js"' in html
    assert html.index('public-demo.js') < html.index('src="./static/app.js"')
    assert 'href="/static/' not in html
    assert 'value="live"' not in html
    assert 'only in this browser' in html
    assert (tmp_path / '.nojekyll').exists()
    data = json.loads((tmp_path / 'static/demo.json').read_text(encoding='utf-8'))
    assert [s['passed'] for s in data['run']['summaries']] == [7, 10, 8]
    assert data['run']['mode'] == 'demo'
    assert len(data['dataset']['cases']) == 12
    import os
    assert os.environ['AIRS_DB'] == 'preserved.sqlite3'
