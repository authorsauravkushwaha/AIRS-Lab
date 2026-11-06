"""OpenAI-compatible API provider. API key is read server-side from env only."""
import os
import time

import httpx

from app.config import settings
from app.models import ModelConfig
from app.providers.base import BaseProvider, ModelResponse, ProviderError


class OpenAICompatProvider(BaseProvider):
    name = "openai_compat"

    def __init__(self, config: ModelConfig):
        self.config = config
        key = os.environ.get(config.api_key_env) if config.api_key_env else settings.openai_api_key
        if not key:
            raise ProviderError(
                f"No API key configured. Set the {config.api_key_env or 'AEGIS_OPENAI_API_KEY'} environment variable."
            )
        self._key = key
        self._base = (config.base_url or "https://api.openai.com/v1").rstrip("/")

    def generate(self, prompt: str, system: str = "") -> ModelResponse:
        messages = ([{"role": "system", "content": system}] if system else []) + [
            {"role": "user", "content": prompt}
        ]
        start = time.perf_counter()
        try:
            with httpx.Client(timeout=60) as client:
                r = client.post(
                    f"{self._base}/chat/completions",
                    headers={"Authorization": f"Bearer {self._key}"},
                    json={"model": self.config.model_id, "messages": messages},
                )
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPError as e:
            raise ProviderError(f"Provider request failed: {e}") from e
        latency = (time.perf_counter() - start) * 1000
        choice = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return ModelResponse(
            text=choice,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            latency_ms=round(latency, 1),
            raw={"provider": self.name, "model": data.get("model", self.config.model_id)},
        )

    def test_connection(self) -> tuple[bool, str]:
        try:
            self.generate("Reply with the single word: pong", system="")
            return True, "Connection OK."
        except ProviderError as e:
            return False, str(e)
