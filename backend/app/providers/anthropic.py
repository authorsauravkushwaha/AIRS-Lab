"""Native Anthropic Messages API provider (/v1/messages).
API key is read strictly from server-side environment variables.
"""

import json
import os
import time

import httpx

from app.config import settings
from app.models import ModelConfig
from app.providers.base import BaseProvider, ModelResponse, ProviderError


class AnthropicProvider(BaseProvider):
    name = "anthropic"

    def __init__(self, config: ModelConfig):
        self.config = config
        key = os.environ.get(config.api_key_env) if config.api_key_env else settings.anthropic_api_key
        if not key:
            raise ProviderError(
                f"No Anthropic API key configured. Set {config.api_key_env or 'AEGIS_ANTHROPIC_API_KEY'}."
            )
        self._key = key
        self._base = (config.base_url or "https://api.anthropic.com/v1").rstrip("/")

    def generate(self, prompt: str, system: str = "", tools: list[dict] | None = None) -> ModelResponse:
        eff_sys = system or (self.config.system_prompt or "")
        payload: dict = {
            "model": self.config.model_id,
            "max_tokens": self.config.max_tokens or 1024,
            "temperature": self.config.temperature if self.config.temperature is not None else 0.0,
            "messages": [{"role": "user", "content": prompt}],
        }
        if eff_sys:
            payload["system"] = eff_sys
        if tools:
            payload["tools"] = tools

        start = time.perf_counter()
        try:
            with httpx.Client(timeout=60) as client:
                r = client.post(
                    f"{self._base}/messages",
                    headers={
                        "x-api-key": self._key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json=payload,
                )
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPError as e:
            raise ProviderError(f"Anthropic request failed: {e}") from e

        latency = (time.perf_counter() - start) * 1000
        blocks = data.get("content") or []
        texts = [b.get("text", "") for b in blocks if b.get("type") == "text"]
        tool_calls = [
            {"tool": b.get("name", ""), "arguments": b.get("input", {})} for b in blocks if b.get("type") == "tool_use"
        ]
        text_out = "\n".join(t for t in texts if t).strip()
        if not text_out and tool_calls:
            text_out = json.dumps(tool_calls[0])
        usage = data.get("usage", {})
        return ModelResponse(
            text=text_out,
            tokens_in=usage.get("input_tokens", 0),
            tokens_out=usage.get("output_tokens", 0),
            latency_ms=round(latency, 1),
            tool_calls=tool_calls,
            raw={"provider": self.name, "model": data.get("model", self.config.model_id)},
        )

    def test_connection(self) -> tuple[bool, str]:
        try:
            self.generate("Reply with the single word: pong", system="")
            return True, "Anthropic connection OK."
        except ProviderError as e:
            return False, str(e)
