from unittest.mock import Mock

import httpx
import pytest
from groq import APIStatusError

from app.agents.groq_provider import GroqProvider, PlanningFailure


@pytest.mark.parametrize(
    "status,code,retryable",
    [
        (429, "AI_RATE_LIMITED", True),
        (401, "AI_AUTH_FAILED", False),
        (500, "AI_REQUEST_FAILED", True),
        (400, "AI_REQUEST_FAILED", False),
    ],
)
def test_provider_redacts_errors_and_classifies_retries(status, code, retryable):
    provider = GroqProvider.__new__(GroqProvider)
    provider.calls = provider.input_tokens = provider.output_tokens = 0
    provider.client = Mock()
    response = httpx.Response(
        status,
        headers={"retry-after": "30"},
        request=httpx.Request(
            "POST", "https://api.groq.com/openai/v1/chat/completions"
        ),
    )
    provider.client.chat.completions.create.side_effect = APIStatusError(
        "private provider text", response=response, body={"private": "response"}
    )
    with pytest.raises(PlanningFailure) as caught:
        provider.complete([])
    assert str(caught.value) == code
    assert caught.value.retryable == retryable
    assert caught.value.retry_after == 30
