"""Provider-independent LLM adapter interface."""
from dataclasses import dataclass, field


@dataclass
class ModelResponse:
    text: str
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: float = 0.0
    ttft_ms: float = 0.0
    tool_calls: list[dict] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


class ProviderError(Exception):
    """Raised when a provider cannot produce a response."""


class BaseProvider:
    name = "base"

    def generate(self, prompt: str, system: str = "", tools: list[dict] | None = None) -> ModelResponse:
        raise NotImplementedError

    def test_connection(self) -> tuple[bool, str]:
        raise NotImplementedError
