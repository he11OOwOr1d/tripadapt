/** Provider codes only; never render or log request bodies, tokens, or raw upstream errors. */
export function authErrorMessage(failure: unknown) {
  const value =
    failure && typeof failure === "object"
      ? (failure as { code?: unknown; status?: unknown; name?: unknown })
      : {};
  const code =
    typeof value.code === "string" && /^[a-z_]{1,80}$/.test(value.code)
      ? value.code
      : "";
  const messages: Record<string, string> = {
    weak_password:
      "Choose a longer, unique password that meets the account password policy.",
    over_email_send_rate_limit:
      "Account email requests are temporarily rate-limited. Wait before requesting another email.",
    over_request_rate_limit:
      "Too many requests. Wait a little before trying again.",
    email_address_invalid: "Enter a valid email address, then try again.",
    email_address_not_authorized:
      "This project cannot send account emails to that address yet. The project owner needs to configure email delivery.",
    signup_disabled: "Account creation is currently disabled for this project.",
    email_provider_disabled:
      "Email sign-in is currently disabled for this project.",
    email_not_confirmed:
      "Confirm your email before signing in. Check your inbox for the confirmation link.",
    invalid_credentials: "Could not sign in. Check your email and password.",
    unexpected_failure:
      "The account service could not complete this request. Your trip is kept; contact the project owner.",
    user_already_exists:
      "Unable to create this account. Try signing in or recovering your password.",
    validation_failed: "Check your email and password, then try again.",
    captcha_failed:
      "Account verification could not be completed. Contact the project owner.",
  };
  const message =
    messages[code] ??
    (value.status === 401
      ? "The sign-in service configuration was rejected. Contact the project owner."
      : "Could not reach the account service. Check your connection and try again. Your trip is still in this browser.");
  // Local diagnostics expose only a bounded provider code/status, never credentials.
  const diagnostic =
    process.env.NODE_ENV === "development"
      ? ` (Reference: ${
          code ||
          String(value.name || "connection")
            .replace(/[^a-zA-Z]/g, "")
            .slice(0, 40)
        }${typeof value.status === "number" ? ` / ${value.status}` : ""}.)`
      : "";
  return message + diagnostic;
}
