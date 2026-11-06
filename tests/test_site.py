import json
from scripts.build_site import build


def test_public_site_build(tmp_path, monkeypatch):
    monkeypatch.setenv('AIRS_DB', 'preserved.sqlite3')
    build(tmp_path)
    html = (tmp_path / 'index.html').read_text()
    assert 'src="./static/public-demo.js"' in html
    assert html.index('public-demo.js') < html.index('src="./static/app.js"')
    assert 'href="/static/' not in html
    assert 'value="live"' not in html
    assert 'only in this browser' in html
    assert (tmp_path / '.nojekyll').exists()
    data = json.loads((tmp_path / 'static/demo.json').read_text())
    assert [s['passed'] for s in data['run']['summaries']] == [7, 10, 8]
    assert data['run']['mode'] == 'demo'
    assert len(data['dataset']['cases']) == 12
    import os
    assert os.environ['AIRS_DB'] == 'preserved.sqlite3'
