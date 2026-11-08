"""Custom Webhook provider — evaluate an entire RAG / Agent / Gateway endpoint end-to-end.

POSTs `{model_id, prompt, system, temperature, max_tokens, tools}` to `config.base_url`
and parses `{response|text|output, tokens_in, tokens_out, tool_calls}`.
"""
import os
import time

import httpx

from app.models import ModelConfig
from app.providers.base import BaseProvider, ModelResponse, ProviderError


class CustomWebhookProvider(BaseProvider):
    name = "custom_webhook"

    def __init__(self, config: ModelConfig):
        self.config = config
        if not (config.base_url or "").strip():
            raise ProviderError("Custom webhook provider requires base_url (e.g. https://rag.internal/eval).")
        self._url = config.base_url.strip()
        self._token = os.environ.get(config.api_key_env, "") if config.api_key_env else ""

    def generate(self, prompt: str, system: str = "", tools: list[dict] | None = None) -> ModelResponse:
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        payload = {
            "model_id": self.config.model_id,
            "prompt": prompt,
            "system": system or (self.config.system_prompt or ""),
            "temperature": self.config.temperature if self.config.temperature is not None else 0.0,
            "max_tokens": self.config.max_tokens or 1024,
            "tools": tools or [],
        }
        start = time.perf_counter()
        try:
            with httpx.Client(timeout=60) as client:
                r = client.post(self._url, headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPError as e:
            raise ProviderError(f"Webhook endpoint failed: {e}") from e
        latency = (time.perf_counter() - start) * 1000
        text = str(data.get("response") or data.get("text") or data.get("output") or "")
        return ModelResponse(
            text=text,
            tokens_in=int(data.get("tokens_in", len(prompt.split()))),
            tokens_out=int(data.get("tokens_out", len(text.split()))),
            latency_ms=round(latency, 1),
            tool_calls=data.get("tool_calls") or [],
            raw={"provider": self.name, "retrieved_docs": data.get("retrieved_docs")},
        )

    def test_connection(self) -> tuple[bool, str]:
        try:
            self.generate("healthcheck ping", system="")
            return True, f"Webhook endpoint {self._url} responded OK."
        except ProviderError as e:
            return False, str(e)
