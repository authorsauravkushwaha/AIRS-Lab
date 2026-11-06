"""Provider factory — keeps provider-specific code out of business logic."""
from app.models import ModelConfig
from app.providers.base import BaseProvider, ProviderError
from app.providers.mock import MockProvider


def get_provider(config: ModelConfig) -> BaseProvider:
    if config.provider == "mock":
        return MockProvider()
    if config.provider == "openai_compat":
        from app.providers.openai_compat import OpenAICompatProvider
        return OpenAICompatProvider(config)
    if config.provider == "ollama":
        from app.providers.ollama import OllamaProvider
        return OllamaProvider(config)
    raise ProviderError(f"Unknown provider: {config.provider}")
