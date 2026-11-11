"""OpenAI-compatible API provider (OpenAI, vLLM, SGLang, Together, Groq, Azure).
API key is read server-side from env only, with exponential backoff on 429/5xx.
"""

import json
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

    def generate(self, prompt: str, system: str = "", tools: list[dict] | None = None) -> ModelResponse:
        eff_sys = system or (self.config.system_prompt or "")
        messages = ([{"role": "system", "content": eff_sys}] if eff_sys else []) + [{"role": "user", "content": prompt}]
        payload: dict = {
            "model": self.config.model_id,
            "messages": messages,
            "temperature": self.config.temperature if self.config.temperature is not None else 0.0,
        }
        if self.config.max_tokens:
            payload["max_tokens"] = self.config.max_tokens
        if tools:
            payload["tools"] = tools

        last_err: Exception | None = None
        for attempt in range(3):
            start = time.perf_counter()
            try:
                with httpx.Client(timeout=60) as client:
                    r = client.post(
                        f"{self._base}/chat/completions",
                        headers={"Authorization": f"Bearer {self._key}"},
                        json=payload,
                    )
                    if r.status_code in (429, 502, 503, 504) and attempt < 2:
                        time.sleep(0.5 * (2**attempt))
                        continue
                    r.raise_for_status()
                    data = r.json()
                latency = (time.perf_counter() - start) * 1000
                msg = data["choices"][0]["message"]
                choice = msg.get("content") or ""
                raw_tools = msg.get("tool_calls") or []
                parsed_tools = []
                for tc in raw_tools:
                    fn = tc.get("function", {})
                    try:
                        args = json.loads(fn.get("arguments") or "{}")
                    except ValueError:
                        args = {"_raw": fn.get("arguments")}
                    parsed_tools.append({"tool": fn.get("name", ""), "arguments": args})
                if not choice and parsed_tools:
                    choice = json.dumps(parsed_tools[0])
                usage = data.get("usage", {})
                return ModelResponse(
                    text=choice,
                    tokens_in=usage.get("prompt_tokens", 0),
                    tokens_out=usage.get("completion_tokens", 0),
                    latency_ms=round(latency, 1),
                    tool_calls=parsed_tools,
                    raw={"provider": self.name, "model": data.get("model", self.config.model_id)},
                )
            except httpx.HTTPError as e:
                last_err = e
                if attempt < 2:
                    time.sleep(0.4 * (2**attempt))
                    continue
                raise ProviderError(f"Provider request failed: {e}") from e
        raise ProviderError(f"Provider request failed: {last_err}")

    def test_connection(self) -> tuple[bool, str]:
        try:
            self.generate("Reply with the single word: pong", system="")
            return True, "Connection OK."
        except ProviderError as e:
            return False, str(e)
