export interface Health {
  status: string
  service: string
  version: string
}
export interface Project {
  id: string; name: string; description: string; created_at: string
  model_count: number; suite_count: number; case_count: number; run_count: number
}
export interface ModelConfig {
  id: string; project_id: string; name: string; provider: string; model_id: string
  base_url: string; api_key_env: string
  system_prompt?: string; temperature?: number; max_tokens?: number
  input_cost_per_1m?: number | null; output_cost_per_1m?: number | null
  effective_input_cost_per_1m?: number; effective_output_cost_per_1m?: number
  pricing_source?: string
  enabled: boolean; last_status: string; created_at: string
}
export interface Suite {
  id: string; project_id: string; name: string; description: string
  domain_pack?: string; dataset_hash?: string
  case_count: number; created_at: string
}
export interface SuiteTemplate {
  id: string; name: string; audience: string; description: string
  case_count: number; categories: string[]
}
export interface Case {
  id: string; suite_id: string; name: string; category: string; prompt: string
  reference_answer: string; expected_keywords: string[]; source_docs: string[]
  expected_schema: Record<string, unknown> | null
  tools_config?: Record<string, unknown> | null
  expected_behavior: string
  severity: string; evaluation_criteria: string; created_at: string
}
export interface Run {
  id: string; project_id?: string; suite_id?: string; model_id?: string
  status: string; kind: string
  dataset_hash?: string; evaluator_version?: string; concurrency?: number
  summary: Record<string, unknown>; started_at: string; finished_at: string | null
}
export interface Result {
  id: string; test_case_id: string; case_name: string; case_category: string; case_severity: string
  prompt: string; reference_answer: string
  status: string; method: string; score: number
  response: string; evidence: Record<string, unknown>; latency_ms: number
  ttft_ms?: number; cached?: boolean
  tokens_in: number; tokens_out: number; est_cost_usd: number
}
export interface Finding {
  id: string; run_id: string; test_name: string; category: string; severity: string
  owasp_id?: string; mitre_atlas_id?: string; cwe_id?: string
  test_input: string; model_response: string; expected_behavior: string; actual_behavior: string
  outcome: string; evidence: Record<string, unknown>; mitigation: string; created_at: string
}
export interface Overview {
  total_runs: number; total_test_cases: number; pass_rate: number | null
  wilson_95_ci?: [number, number] | null
  failed: number; uncertain: number; errors: number
  security_by_severity: Record<string, number>
  avg_latency_ms: number | null; p95_latency_ms?: number | null
  total_tokens: number; total_cost_usd?: number; total_reports: number
  total_gates?: number; approved_gates?: number; total_traces?: number
  audit_chain_valid?: boolean; audit_events_verified?: number
  pass_rate_trend: { id: string; label: string; pass_rate: number | null }[]
  category_breakdown: { category: string; total: number; passed: number; pass_rate: number | null }[]
  recent_runs: {
    id: string; kind: string; status: string; model_name: string | null
    dataset_hash?: string; summary: Record<string, unknown>; started_at: string
  }[]
}
export interface AuditChainStatus {
  valid: boolean; checked_events: number; head_hash: string
  broken_at?: Record<string, unknown> | null
}
export interface SystemConfig {
  service: string; version: string; evaluator_version?: string; database: string
  secret_redaction_enabled: boolean
  openai_key_configured: boolean; openai_key_env: string
  anthropic_key_configured?: boolean; anthropic_key_env?: string
  ollama_base_url: string; frontend_served: boolean
  audit_chain?: AuditChainStatus
  counts: {
    runs: number; results: number; findings: number; reports: number
    gates?: number; traces?: number; cached_responses?: number
  }
}
export interface AuditEvent {
  id: string; seq?: number; event_type: string; entity: string; detail: string
  prev_hash?: string; entry_hash?: string; created_at: string
}
export interface ReportItem {
  id: string; project_id: string; run_id: string; format: string; title: string
  sha256_hash?: string; created_at: string
}
export interface ReleaseGate {
  id: string; project_id: string; name: string; description: string; suite_id: string
  min_pass_rate: number; max_critical_findings: number; max_high_findings: number
  max_avg_latency_ms: number | null; max_cost_per_case_usd: number | null
  require_audit_integrity: boolean
  last_verdict: 'approved' | 'blocked' | 'untested'
  last_model_id: string
  last_certificate: {
    gate_id?: string; model_name?: string; verdict?: string
    dataset_hash?: string | null; certificate_sha256?: string
    checks?: { check: string; expected: string; actual: string; passed: boolean }[]
    blocking_reasons?: string[]; evaluated_at?: string
  }
  last_evaluated_at: string | null; created_at: string
}
export interface ProductionTrace {
  id: string; project_id: string; model_name: string
  prompt_redacted: string; response_redacted: string; expected_answer_hint: string
  flagged_reason: string; redactions_applied: string[]
  latency_ms: number; tokens_in: number; tokens_out: number
  promoted_case_id: string; created_at: string
}
