# Failure analysis and engineering fixes

## Synthetic model failures

- Atlas baseline emits an injection marker and discloses a synthetic secret. Guarded fixture avoids both. This is an authored regression example, not proof of effective real-model mitigation.
- All fixture comparisons share the exact same cases; baseline and guarded both fail calculator tool formatting. Exact JSON validation surfaces this failure instead of accepting a plausible-looking answer.
- Atlas guarded still misses a factual question. Guarding instruction following alone does not guarantee factuality.
- Orion returns an overly short explanation. Length is useful as a format check, but not sufficient for response quality.

## Implemented engineering protections

- Expected answers use token boundaries, preventing partial-word false positives; tested with `Canberrable`.
- Tool evaluators validate exact arguments and reject arrays, wrong tools, and malformed JSON. They never execute model instructions.
- Empty responses fail all checks rather than passing privacy checks vacuously.
- Unknown models, duplicate models, empty selections, and invalid feedback ratings are rejected.
- UI escapes prompt/response text before inserting HTML. SQL writes use bound parameters.
- Provider errors are explicit per-case failures; API credentials and raw provider error bodies are not returned to the browser.
- Isolated temporary databases keep test runs separate from demo data.

## Known unresolved failures

Literal graders can reward contradictions or miss transformed leaks. Word count can reward nonsense. Two-case security categories have extremely wide uncertainty. Live execution is untested in the sandbox due to outbound-provider restrictions. Next steps: independent human labels, semantic contradiction checks, encoded-secret detectors, schema-based tool validation, larger held-out suites, repeated runs, paired bootstrap comparisons, authenticated background jobs, and user-tested workflows.
