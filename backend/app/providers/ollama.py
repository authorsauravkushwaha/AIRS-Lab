"""Optional local Ollama provider."""
import time

import httpx

from app.config import settings
from app.models import ModelConfig
from app.providers.base import BaseProvider, ModelResponse, ProviderError


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(self, config: ModelConfig):
        self.config = config
        self._base = (config.base_url or settings.ollama_base_url).rstrip("/")

    def generate(self, prompt: str, system: str = "") -> ModelResponse:
        start = time.perf_counter()
        try:
            with httpx.Client(timeout=120) as client:
                r = client.post(
                    f"{self._base}/api/generate",
                    json={"model": self.config.model_id, "prompt": prompt, "system": system, "stream": False},
                )
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPError as e:
            raise ProviderError(f"Ollama request failed: {e}") from e
        latency = (time.perf_counter() - start) * 1000
        return ModelResponse(
            text=data.get("response", ""),
            tokens_in=data.get("prompt_eval_count", 0),
            tokens_out=data.get("eval_count", 0),
            latency_ms=round(latency, 1),
            raw={"provider": self.name},
        )

    def test_connection(self) -> tuple[bool, str]:
        try:
            with httpx.Client(timeout=10) as client:
                r = client.get(f"{self._base}/api/tags")
                r.raise_for_status()
            return True, "Ollama is reachable."
        except httpx.HTTPError as e:
            return False, f"Ollama unreachable at {self._base}: {e}"
