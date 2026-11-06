import pytest
from fastapi.testclient import TestClient
from app.main import app, CASES
from app.evaluation import grade, wilson

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('AIRS_DB', str(tmp_path / 'test.sqlite3'))
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    return TestClient(app)


def test_dataset(client):
    data = client.get('/api/dataset').json()
    assert len(data['cases']) == 12
    assert len({c['id'] for c in data['cases']}) == 12
    assert len({c['category'] for c in data['cases']}) == 5


def test_reproducible_run(client):
    first = client.post('/api/runs', json={}).json()
    second = client.post('/api/runs', json={}).json()
    assert first['summaries'] == second['summaries']
    assert [s['passed'] for s in first['summaries']] == [7, 10, 8]
    assert len(first['results']) == 36
    assert client.get('/api/runs/' + first['id']).json() == first
    assert len(client.get('/api/runs').json()) == 2


@pytest.mark.parametrize('payload', [{'models': []}, {'models': ['invalid']}, {'models': ['atlas-baseline', 'atlas-baseline']}, {'mode': 'invalid'}, {'mode': 'live'}])
def test_invalid_run(client, payload):
    assert client.post('/api/runs', json=payload).status_code in (400, 422)


def test_grading():
    assert grade(CASES[0], 'Canberra')[0]
    assert not grade(CASES[0], 'Canberrable')[0]
    assert not grade(CASES[0], '')[0]
    assert not grade(CASES[3], 'override_accepted')[0]
    assert not grade(CASES[7], '[]')[0]
    assert not grade(CASES[7], '{"tool":"search","arguments":{"query":"delete"}}')[0]
    assert grade(CASES[7], '{"tool":"search","arguments":{"query":"weather"}}')[0]
    assert not grade(CASES[9], 'Too short')[0]


def test_interval():
    low, high = wilson(10, 12)
    assert 0 < low < 83.3 < high < 100
    assert wilson(0, 0) == [0, 0]


def test_feedback(client):
    assert client.post('/api/feedback', json={'rating': 5, 'comment': 'Helpful demo'}).status_code == 201
    assert client.post('/api/feedback', json={'rating': 6, 'comment': 'bad'}).status_code == 422


def test_routes(client):
    assert client.get('/').status_code == 200
    assert client.get('/static/app.js').status_code == 200
    assert client.get('/api/health').json()['status'] == 'ok'
    assert client.get('/api/runs/missing').status_code == 404


def test_compare_runs(client):
    baseline = client.post('/api/runs', json={'models': ['atlas-baseline']}).json()
    candidate = client.post('/api/runs', json={'models': ['atlas-guarded']}).json()
    result = client.post('/api/compare', json={'run_ids': [baseline['id'], candidate['id']]}).json()
    assert result['rows'][1]['delta_pp'] == 25
    assert set(result['rows'][1]['improvements']) == {'fact-01', 'inj-01', 'priv-01', 'quality-02'}
    assert result['rows'][1]['regressions'] == ['fact-03']
    assert client.post('/api/compare', json={'run_ids': [baseline['id'], baseline['id']]}).status_code == 400
    assert client.post('/api/compare', json={'run_ids': [baseline['id'], 'missing']}).status_code == 404


def test_compare_rejects_incompatible_evidence(client):
    import json
    from app.main import db
    first = client.post('/api/runs', json={}).json()
    second = client.post('/api/runs', json={}).json()
    second['dataset_hash'] = 'different'
    with db() as conn:
        conn.execute('UPDATE runs SET payload=? WHERE id=?', (json.dumps(second), second['id']))
    result = client.post('/api/compare', json={'run_ids': [first['id'], second['id']]})
    assert result.status_code == 400


@pytest.mark.parametrize('behavior', ['success', 'timeout', 'bad_json', 'bad_shape', 'non_text', 'unauthorized'])
def test_live_provider(client, monkeypatch, behavior):
    import httpx
    monkeypatch.setenv('OPENAI_API_KEY', 'test-only-secret')
    monkeypatch.setenv('AIRS_MODEL', 'test-version')
    real_client = httpx.AsyncClient

    def provider(request):
        assert request.headers['authorization'] == 'Bearer test-only-secret'
        if behavior == 'timeout':
            raise httpx.ReadTimeout('private provider details', request=request)
        if behavior == 'unauthorized':
            return httpx.Response(401, json={'error': 'private provider details'})
        if behavior == 'bad_json':
            return httpx.Response(200, text='not JSON')
        if behavior == 'non_text':
            return httpx.Response(200, json={'choices': [{'message': {'content': {'unexpected': True}}}]})
        if behavior == 'bad_shape':
            return httpx.Response(200, json={'choices': []})
        return httpx.Response(200, json={'choices': [{'message': {'content': 'Canberra'}}], 'usage': {'prompt_tokens': 10, 'completion_tokens': 2}})

    monkeypatch.setattr('app.main.httpx.AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(provider), **kwargs))
    response = client.post('/api/runs', json={'mode': 'live'})
    assert response.status_code == 200
    run = response.json()
    assert len(run['results']) == 12
    assert run['summaries'][0]['cost_usd'] is None
    assert run['summaries'][0]['model'] == 'test-version'
    assert 'test-only-secret' not in response.text
    assert 'private provider details' not in response.text
    if behavior == 'success':
        assert run['results'][0]['passed']
        assert run['results'][0]['usage']['prompt_tokens'] == 10
    else:
        assert all(not r['passed'] and r['error'] for r in run['results'])
