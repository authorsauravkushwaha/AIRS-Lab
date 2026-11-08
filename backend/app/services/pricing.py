"""Versioned token pricing ledger and Inference Arbitrage ROI calculator.

Rates are USD per 1,000,000 tokens (input, output). Custom per-model overrides
on ModelConfig always take precedence so enterprises can plug in negotiated
private rate cards or self-hosted GPU amortized rates.
"""
from app.models import ModelConfig

PRICING_VERSION = "2026.11"

# (input_usd_per_1m, output_usd_per_1m)
MODEL_RATES_PER_1M: dict[str, tuple[float, float]] = {
    # OpenAI frontier & reasoning
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "o1": (15.00, 60.00),
    "o3-mini": (1.10, 4.40),
    # Anthropic Claude
    "claude-3-7-sonnet": (3.00, 15.00),
    "claude-3-5-sonnet": (3.00, 15.00),
    "claude-3-5-haiku": (0.80, 4.00),
    "claude-3-opus": (15.00, 75.00),
    # Open-weights / self-hosted / vLLM reference amortized GPU rates
    "llama-3.3-70b": (0.59, 0.79),
    "llama-3.1-8b": (0.05, 0.08),
    "qwen-2.5-72b": (0.40, 0.60),
    "deepseek-v3": (0.27, 1.10),
    "deepseek-r1": (0.55, 2.19),
    # Mock reference profiles (illustrative cost tiers so arbitrage math works offline)
    "mock-frontier-pro": (10.00, 30.00),
    "mock-atlas-guarded": (0.80, 2.40),
    "mock-atlas-baseline": (0.50, 1.50),
    "mock-orion-small": (0.10, 0.30),
    "mock-v1": (0.50, 1.50),
}


def resolve_rates(model: ModelConfig) -> tuple[float, float, str]:
    """Return (input_per_1m, output_per_1m, rate_source)."""
    if model.input_cost_per_1m is not None or model.output_cost_per_1m is not None:
        return (model.input_cost_per_1m or 0.0, model.output_cost_per_1m or 0.0, "custom_override")

    mid = (model.model_id or "").lower()
    if mid in MODEL_RATES_PER_1M:
        inp, out = MODEL_RATES_PER_1M[mid]
        return inp, out, f"ledger:{PRICING_VERSION}"
    for prefix, (inp, out) in MODEL_RATES_PER_1M.items():
        if mid.startswith(prefix):
            return inp, out, f"ledger:{PRICING_VERSION}"
    if model.provider == "ollama":
        return 0.05, 0.10, "self_hosted_estimate"
    return 0.0, 0.0, "unpriced"


def estimate_cost_usd(model: ModelConfig, tokens_in: int, tokens_out: int) -> float:
    inp_rate, out_rate, _ = resolve_rates(model)
    cost = (tokens_in * inp_rate + tokens_out * out_rate) / 1_000_000.0
    return round(cost, 8)


def compute_arbitrage_roi(
    baseline_cost_per_call: float,
    candidate_cost_per_call: float,
    baseline_pass_rate: float | None,
    candidate_pass_rate: float | None,
    monthly_calls: int = 1_000_000,
) -> dict:
    """Quantify annualized EBITDA / inference savings & Cost-Per-Verified-Pass."""
    monthly_baseline = baseline_cost_per_call * monthly_calls
    monthly_candidate = candidate_cost_per_call * monthly_calls
    annual_savings = (monthly_baseline - monthly_candidate) * 12.0
    b_cppt = (baseline_cost_per_call / (baseline_pass_rate / 100.0)) if (baseline_pass_rate and baseline_pass_rate > 0) else None
    c_cppt = (candidate_cost_per_call / (candidate_pass_rate / 100.0)) if (candidate_pass_rate and candidate_pass_rate > 0) else None
    quality_delta_pp = (
        round(candidate_pass_rate - baseline_pass_rate, 2)
        if (baseline_pass_rate is not None and candidate_pass_rate is not None)
        else None
    )
    return {
        "monthly_calls_assumed": monthly_calls,
        "monthly_baseline_usd": round(monthly_baseline, 2),
        "monthly_candidate_usd": round(monthly_candidate, 2),
        "annual_savings_usd": round(annual_savings, 2),
        "cost_reduction_pct": round((1 - candidate_cost_per_call / baseline_cost_per_call) * 100, 1)
        if baseline_cost_per_call > 0 else None,
        "baseline_cost_per_verified_pass_usd": round(b_cppt, 8) if b_cppt is not None else None,
        "candidate_cost_per_verified_pass_usd": round(c_cppt, 8) if c_cppt is not None else None,
        "quality_delta_pp": quality_delta_pp,
    }
