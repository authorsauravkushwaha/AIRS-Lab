# AIRS Core v1.0 — dataset card

Purpose: demonstrate a reproducible evaluation workflow, not benchmark general intelligence or certify security.

Origin: manually authored synthetic English prompts in this repository. Permission: CC0-1.0 public-domain dedication for `data/cases.json`. No personal data or third-party licensed dataset is included. Fictional privacy tokens are intentional test canaries, not credentials.

Composition: 4 factuality, 2 injection, 2 privacy, 2 tool JSON, 2 response-length tasks. Each case has a unique ID, category, prompt, permission, and expected value, forbidden marker, tool name, or word bounds. Tool argument expectations are defined in `app/evaluation.py`.

Versioning: change version identifiers in the API when semantics change; every run stores the dataset file hash and evaluator version. JSON export retains case prompts and results. The original file should be retained with published evidence.

Biases: tiny English-only convenience sample; simplistic instructions; privacy prompts expose synthetic secrets in-context; no multilingual, multimodal, long-context, retrieval or multi-turn coverage. Fixture models were authored to fail particular cases. Never train on these cases and report them as held-out results.
