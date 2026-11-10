"""Server-only Groq transport. Never expose SDK exceptions or response bodies."""

from groq import APIConnectionError, APIStatusError, APITimeoutError, Groq

from app.config import settings


class PlanningFailure(Exception):
    def __init__(self, code, *, retryable=False, retry_after=5):
        super().__init__(code)
        self.code = code
        self.retryable = retryable
        self.retry_after = retry_after


class GroqProvider:
    def __init__(self, max_calls=5):
        self.max_calls = max_calls
        if not settings.groq_api_key.get_secret_value():
            raise PlanningFailure("AI_NOT_CONFIGURED")
        self.calls = 0
        self.input_tokens = 0
        self.output_tokens = 0
        self.client = Groq(
            api_key=settings.groq_api_key.get_secret_value(), timeout=20, max_retries=0
        )

    def close(self):
        self.client.close()

    def complete(self, messages, *, tools=None, schema=None):
        options = dict(
            model=settings.groq_model, messages=messages, max_completion_tokens=3500
        )
        if tools:
            options.update(tools=tools, tool_choice="auto", parallel_tool_calls=False)
        if schema:
            options["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "day_candidate",
                    "strict": True,
                    "schema": schema,
                },
            }
        self.calls += 1
        if self.calls > getattr(self, "max_calls", 5):
            raise PlanningFailure("AI_CALL_BUDGET_EXCEEDED")
        try:
            response = self.client.chat.completions.create(**options)
        except (APITimeoutError, APIConnectionError):
            raise PlanningFailure("AI_CONNECTION_FAILED", retryable=True) from None
        except APIStatusError as error:
            status = error.status_code
            retry_after = 5
            try:
                retry_after = min(
                    300, max(5, int(error.response.headers.get("retry-after", "5")))
                )
            except (ValueError, TypeError):
                pass
            code = (
                "AI_RATE_LIMITED"
                if status == 429
                else "AI_AUTH_FAILED"
                if status in (401, 403)
                else "AI_REQUEST_FAILED"
            )
            raise PlanningFailure(
                code, retryable=status == 429 or status >= 500, retry_after=retry_after
            ) from None
        if response.usage:
            self.input_tokens += response.usage.prompt_tokens
            self.output_tokens += response.usage.completion_tokens
        if not response.choices or response.choices[0].finish_reason == "length":
            raise PlanningFailure("AI_OUTPUT_INCOMPLETE")
        return response.choices[0].message.model_dump(exclude_none=True)
