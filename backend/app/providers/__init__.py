"""Provider factory — keeps provider-specific code out of business logic."""

from app.models import ModelConfig
from app.providers.base import BaseProvider, ProviderError
from app.providers.mock import MockProvider


def get_provider(config: ModelConfig) -> BaseProvider:
    if config.provider == "mock":
        return MockProvider(config.model_id, system_prompt=config.system_prompt or "")
    if config.provider == "openai_compat":
        from app.providers.openai_compat import OpenAICompatProvider

        return OpenAICompatProvider(config)
    if config.provider == "anthropic":
        from app.providers.anthropic import AnthropicProvider

        return AnthropicProvider(config)
    if config.provider == "ollama":
        from app.providers.ollama import OllamaProvider

        return OllamaProvider(config)
    if config.provider == "custom_webhook":
        from app.providers.webhook import CustomWebhookProvider

        return CustomWebhookProvider(config)
    raise ProviderError(f"Unknown provider: {config.provider}")
