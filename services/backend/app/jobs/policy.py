"""Application permissions, never inferred from model output."""

READ_ONLY_CHAT_KINDS = frozenset({"answer", "clarify", "remaining_handoff"})


def lifecycle_allows_job(lifecycle, operation):
    return lifecycle == "planning" or (lifecycle == "active" and operation == "chat")


def readonly_reply(reply):
    return (
        bool(reply)
        and reply.get("kind") in READ_ONLY_CHAT_KINDS
        and not any(key in reply for key in ("candidate", "weather_focus"))
    )
