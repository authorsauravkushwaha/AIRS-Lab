export interface Project { id: string; name: string; description: string; created_at: string }
export interface ModelConfig {
  id: string; project_id: string; name: string; provider: string; model_id: string;
  base_url: string; api_key_env: string; enabled: boolean; last_status: string; created_at: string
}
export interface Suite { id: string; project_id: string; name: string; description: string; case_count: number; created_at: string }
export interface Case {
  id: string; suite_id: string; name: string; category: string; prompt: string;
  reference_answer: string; expected_keywords: string[]; source_docs: string[];
  expected_schema: Record<string, unknown> | null; expected_behavior: string;
  severity: string; evaluation_criteria: string; created_at: string
}
export interface Run { id: string; status: string; kind: string; summary: Record<string, unknown>; started_at: string; finished_at: string | null }
export interface Result {
  id: string; test_case_id: string; status: string; method: string; score: number;
  response: string; evidence: Record<string, unknown>; latency_ms: number;
  tokens_in: number; tokens_out: number; est_cost_usd: number
}
export interface Finding {
  id: string; run_id: string; test_name: string; category: string; severity: string;
  test_input: string; model_response: string; expected_behavior: string; actual_behavior: string;
  outcome: string; evidence: Record<string, unknown>; mitigation: string; created_at: string
}
export interface Overview {
  total_runs: number; total_test_cases: number; pass_rate: number | null; failed: number;
  uncertain: number; errors: number; security_by_severity: Record<string, number>;
  avg_latency_ms: number | null; total_tokens: number;
  recent_runs: { id: string; kind: string; status: string; summary: Record<string, unknown>; started_at: string }[]
}
