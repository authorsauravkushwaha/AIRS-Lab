"""Build a key-free GitHub Pages demo using the actual Python evaluator."""
import asyncio
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.main import create_run, RunRequest, dataset


def build(output=ROOT / 'site'):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / 'app/static', output / 'static', dirs_exist_ok=True)
    html = (ROOT / 'app/static/index.html').read_text()
    html = html.replace('/static/', './static/').replace('href="/"', 'href="./"')
    html = html.replace('href="/docs"', 'href="https://github.com/authorsauravkushwaha/AIRS-Lab#readme"')
    html = html.replace('API docs ↗', 'Source & docs ↗').replace('Local workspace', 'Browser-only demo')
    html = html.replace('<script src="./static/app.js">', '<script src="./static/public-demo.js"></script><script src="./static/app.js">')
    html = html.replace('<option value="live">Live · server-configured OpenAI model</option>', '')
    html = html.replace('Demo timing and cost are simulated. Live mode sends the synthetic prompts to the configured provider and may incur charges.', 'Synthetic fixtures only. Timing and cost are illustrative. Runs stay in this browser; no API keys or model calls.')
    html = html.replace('Stored locally. Please do not include personal or sensitive data.', 'Saved only in this browser, not sent to the project owner. Please do not include sensitive data.')
    (output / 'index.html').write_text(html)
    (output / '.nojekyll').touch()
    with tempfile.TemporaryDirectory() as temp:
        previous = os.environ.get('AIRS_DB')
        os.environ['AIRS_DB'] = str(Path(temp) / 'build.sqlite3')
        try:
            run = asyncio.run(create_run(RunRequest()))
        finally:
            if previous is None:
                os.environ.pop('AIRS_DB', None)
            else:
                os.environ['AIRS_DB'] = previous
    (output / 'static/demo.json').write_text(json.dumps({'dataset': dataset(), 'run': run}))
    print(f'Built public demo: {output}')


if __name__ == '__main__':
    build()
