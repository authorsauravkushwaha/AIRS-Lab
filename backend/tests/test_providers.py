"""Unit tests for every live provider adapter using httpx.MockTransport.

No network egress: each adapter is exercised against an in-memory transport
that simulates success, retryable throttling, malformed payloads, and outage
conditions. API keys are injected via environment variables exactly as the
production code reads them — never hard-coded.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json

import httpx
import pytest

from app.models import ModelConfig
from app.providers import get_provider
from app.providers.base import ProviderError


def make_config(**overrides) -> ModelConfig:
    """Build a detached ModelConfig with sane defaults (no DB session needed)."""
    fields = {
        "id": "model-1",
        "project_id": "project-1",
        "name": "Test Model",
        "provider": "openai_compat",
        "model_id": "test-model",
        "base_url": "",
        "api_key_env": "",
        "system_prompt": "",
        "temperature": 0.0,
        "max_tokens": 128,
        "input_cost_per_1m": None,
        "output_cost_per_1m": None,
        "enabled": True,
        "last_status": "unknown",
    }
    fields.update(overrides)
    return ModelConfig(**fields)


@pytest.fixture()
def mock_httpx(monkeypatch):
    """Replace httpx.Client so every provider call hits an in-memory transport."""
    real_client = httpx.Client  # capture BEFORE any patching (install may be called twice)

    def install(handler):
        transport = httpx.MockTransport(handler)

        def factory(*args, **kwargs):
            kwargs["transport"] = transport
            return real_client(*args, **kwargs)

        monkeypatch.setattr(httpx, "Client", factory)

    return install


@pytest.fixture()
def no_sleep(monkeypatch):
    """Collapse retry backoff so throttling tests stay fast."""
    import time as _time

    monkeypatch.setattr(_time, "sleep", lambda _s: None)


# --------------------------------------------------------------------------
# Factory
# --------------------------------------------------------------------------
def test_factory_rejects_unknown_provider():
    with pytest.raises(ProviderError, match="Unknown provider"):
        get_provider(make_config(provider="definitely_not_real"))


def test_factory_returns_mock_without_env():
    provider = get_provider(make_config(provider="mock"))
    assert provider.name == "mock"


# --------------------------------------------------------------------------
# openai_compat
# --------------------------------------------------------------------------
def test_openai_missing_key_raises(monkeypatch):
    from app.providers.openai_compat import OpenAICompatProvider

    monkeypatch.delenv("AEGIS_OPENAI_API_KEY", raising=False)
    with pytest.raises(ProviderError, match="No API key configured"):
        OpenAICompatProvider(make_config(api_key_env="AEGIS_OPENAI_API_KEY"))


def test_openai_success_and_usage_parsing(mock_httpx, monkeypatch):
    from app.providers.openai_compat import OpenAICompatProvider

    monkeypatch.setenv("TEST_OPENAI_KEY", "sk-test-123")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "model": "test-model",
                "choices": [
                    {
                        "message": {
                            "content": "pong",
                            "tool_calls": [{"function": {"name": "search_docs", "arguments": '{"query": "x"}'}}],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 11, "completion_tokens": 3},
            },
        )

    mock_httpx(handler)
    provider = OpenAICompatProvider(make_config(api_key_env="TEST_OPENAI_KEY"))
    resp = provider.generate("hi", system="be brief")

    assert resp.text == "pong"
    assert resp.tokens_in == 11 and resp.tokens_out == 3
    assert resp.tool_calls == [{"tool": "search_docs", "arguments": {"query": "x"}}]
    assert seen["auth"] == "Bearer sk-test-123"
    assert seen["body"]["model"] == "test-model"
    assert seen["body"]["messages"][0] == {"role": "system", "content": "be brief"}
    ok, msg = provider.test_connection()
    assert ok and "OK" in msg


def test_openai_retries_throttling_then_succeeds(mock_httpx, no_sleep, monkeypatch):
    from app.providers.openai_compat import OpenAICompatProvider

    monkeypatch.setenv("TEST_OPENAI_KEY", "sk-test")
    attempts = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] < 3:
            return httpx.Response(429, json={"error": {"message": "slow down"}})
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "recovered"}}], "usage": {}},
        )

    mock_httpx(handler)
    provider = OpenAICompatProvider(make_config(api_key_env="TEST_OPENAI_KEY"))
    resp = provider.generate("hi")
    assert resp.text == "recovered"
    assert attempts["n"] == 3


def test_openai_permanent_error_becomes_provider_error(mock_httpx, monkeypatch):
    from app.providers.openai_compat import OpenAICompatProvider

    monkeypatch.setenv("TEST_OPENAI_KEY", "sk-test")
    mock_httpx(lambda _r: httpx.Response(401, json={"error": "bad key"}))
    provider = OpenAICompatProvider(make_config(api_key_env="TEST_OPENAI_KEY"))
    with pytest.raises(ProviderError):
        provider.generate("hi")
    ok, _msg = provider.test_connection()
    assert not ok


def test_openai_malformed_tool_arguments_are_isolated(mock_httpx, monkeypatch):
    from app.providers.openai_compat import OpenAICompatProvider

    monkeypatch.setenv("TEST_OPENAI_KEY", "sk-test")
    mock_httpx(
        lambda _r: httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "",
                            "tool_calls": [{"function": {"name": "calc", "arguments": "{not-json"}}],
                        }
                    }
                ],
                "usage": {},
            },
        )
    )
    provider = OpenAICompatProvider(make_config(api_key_env="TEST_OPENAI_KEY"))
    resp = provider.generate("hi")
    # Raw arguments preserved as inert data — never executed, never raised.
    assert resp.tool_calls[0]["arguments"] == {"_raw": "{not-json"}


# --------------------------------------------------------------------------
# anthropic
# --------------------------------------------------------------------------
def test_anthropic_missing_key_raises(monkeypatch):
    from app.providers.anthropic import AnthropicProvider

    monkeypatch.delenv("AEGIS_ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ProviderError, match="No Anthropic API key configured"):
        AnthropicProvider(make_config(provider="anthropic", api_key_env="AEGIS_ANTHROPIC_API_KEY"))


def test_anthropic_success_text_and_tool_blocks(mock_httpx, monkeypatch):
    from app.providers.anthropic import AnthropicProvider

    monkeypatch.setenv("TEST_ANTHROPIC_KEY", "ant-key")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["headers"] = dict(request.headers)
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "model": "claude-test",
                "content": [
                    {"type": "text", "text": "hello"},
                    {"type": "tool_use", "name": "lookup", "input": {"id": 7}},
                ],
                "usage": {"input_tokens": 9, "output_tokens": 4},
            },
        )

    mock_httpx(handler)
    provider = AnthropicProvider(make_config(provider="anthropic", api_key_env="TEST_ANTHROPIC_KEY"))
    resp = provider.generate("hi", system="sys", tools=[{"name": "lookup"}])

    assert resp.text == "hello"  # text blocks joined; tool_use kept separate
    assert resp.tool_calls == [{"tool": "lookup", "arguments": {"id": 7}}]
    assert resp.tokens_in == 9 and resp.tokens_out == 4
    assert seen["headers"]["x-api-key"] == "ant-key"
    assert seen["headers"]["anthropic-version"] == "2023-06-01"
    assert seen["body"]["system"] == "sys"
    ok, _ = provider.test_connection()
    assert ok


def test_anthropic_http_failure_wrapped(mock_httpx, monkeypatch):
    from app.providers.anthropic import AnthropicProvider

    monkeypatch.setenv("TEST_ANTHROPIC_KEY", "ant-key")
    mock_httpx(lambda _r: httpx.Response(500, text="upstream boom"))
    provider = AnthropicProvider(make_config(provider="anthropic", api_key_env="TEST_ANTHROPIC_KEY"))
    with pytest.raises(ProviderError, match="Anthropic request failed"):
        provider.generate("hi")
    ok, msg = provider.test_connection()
    assert not ok and "failed" in msg.lower()


# --------------------------------------------------------------------------
# ollama
# --------------------------------------------------------------------------
def test_ollama_generate_parses_usage(mock_httpx):
    from app.providers.ollama import OllamaProvider

    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"response": "local answer", "prompt_eval_count": 5, "eval_count": 7},
        )

    mock_httpx(handler)
    provider = OllamaProvider(make_config(provider="ollama", base_url="http://ollama.local:11434"))
    resp = provider.generate("hi", system="ctx")

    assert resp.text == "local answer"
    assert resp.tokens_in == 5 and resp.tokens_out == 7
    assert seen["body"]["model"] == "test-model"
    assert seen["body"]["stream"] is False
    assert seen["body"]["options"]["num_predict"] == 128


def test_ollama_connection_probe(mock_httpx):
    from app.providers.ollama import OllamaProvider

    mock_httpx(lambda _r: httpx.Response(200, json={"models": []}))
    provider = OllamaProvider(make_config(provider="ollama"))
    ok, msg = provider.test_connection()
    assert ok and "reachable" in msg

    mock_httpx(lambda _r: httpx.Response(503, text="no server"))
    provider_down = OllamaProvider(make_config(provider="ollama"))
    ok, msg = provider_down.test_connection()
    assert not ok and "unreachable" in msg


def test_ollama_generate_failure_wrapped(mock_httpx):
    from app.providers.ollama import OllamaProvider

    def refuse(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    mock_httpx(refuse)
    provider = OllamaProvider(make_config(provider="ollama"))
    with pytest.raises(ProviderError, match="Ollama request failed"):
        provider.generate("hi")


# --------------------------------------------------------------------------
# custom_webhook
# --------------------------------------------------------------------------
def test_webhook_requires_base_url():
    from app.providers.webhook import CustomWebhookProvider

    with pytest.raises(ProviderError, match="requires base_url"):
        CustomWebhookProvider(make_config(provider="custom_webhook", base_url="  "))


def test_webhook_success_with_bearer_token(mock_httpx, monkeypatch):
    from app.providers.webhook import CustomWebhookProvider

    monkeypatch.setenv("TEST_WEBHOOK_TOKEN", "tok-abc")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "response": "rag answer",
                "tokens_in": 40,
                "tokens_out": 6,
                "tool_calls": [{"tool": "cite", "arguments": {"doc": 3}}],
                "retrieved_docs": ["d1", "d2"],
            },
        )

    mock_httpx(handler)
    provider = CustomWebhookProvider(
        make_config(provider="custom_webhook", base_url="https://rag.internal/eval", api_key_env="TEST_WEBHOOK_TOKEN")
    )
    resp = provider.generate("question", system="grounded")

    assert resp.text == "rag answer"
    assert resp.tokens_in == 40 and resp.tokens_out == 6
    assert seen["auth"] == "Bearer tok-abc"
    assert seen["body"]["prompt"] == "question"
    assert seen["body"]["system"] == "grounded"
    ok, msg = provider.test_connection()
    assert ok and "responded OK" in msg


def test_webhook_error_wrapped(mock_httpx):
    from app.providers.webhook import CustomWebhookProvider

    mock_httpx(lambda _r: httpx.Response(502, text="bad gateway"))
    provider = CustomWebhookProvider(make_config(provider="custom_webhook", base_url="https://rag.internal/eval"))
    with pytest.raises(ProviderError, match="Webhook endpoint failed"):
        provider.generate("q")
    ok, _ = provider.test_connection()
    assert not ok
