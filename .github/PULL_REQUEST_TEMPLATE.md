## Summary

<!-- What does this PR change, and why? Link related issues: Fixes #123 -->

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation / tooling / CI
- [ ] Refactor (no behavior change)

## Quality gates

All must pass before review (CI runs the same):

- [ ] `ruff check .` and `ruff format --check .`
- [ ] `mypy backend/app airs_cli.py`
- [ ] `pytest tests/ -q` and backend suite with `--cov-fail-under=80`
- [ ] `npm run lint && npm test && npm run build` (if frontend changed)

## Testing

<!-- How did you verify this change? New/updated tests? Manual steps? -->

## Honesty & safety checklist

- [ ] No fabricated metrics, benchmarks, testimonials, or safety claims
- [ ] No secrets, API keys, or personal data committed
- [ ] `UNCERTAIN` verdicts (if touched) are still preserved as first-class evidence
- [ ] Docs updated if API routes, CLI flags, or architecture changed
