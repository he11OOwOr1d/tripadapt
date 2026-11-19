# Focus on the remaining day

17 November 2026. Days containing completed or missed records now offer a checked-by-default “Show recorded outcomes” control. Turning it off hides those cards and explains how many records are hidden. It changes presentation only; all records remain editable when shown again. The preference lasts within the current workspace mount.

Filtering happens after timeline occupancy is calculated. Completed activities therefore retain their occupied time, while missed activities keep their existing free-time semantics. Counts continue to describe all records. The control uses a native checkbox with a 44px label target.

184 frontend tests and the production build, including its TypeScript check, pass. The regression checks that filtering preserves every gap and remaining planned card. Browser interaction and phone layout have not yet been verified for this control. No account writes, backend changes, push or deployment.

Browser follow-up: signed-in desktop verification confirmed hiding and restoring the missed record while retaining the planned card and the same gaps. At 390×844, no horizontal overflow was observed. Fixed shared form styles stacking the checkbox above its label; the final control uses a row with a 44px target. Corrected singular “record” wording. Phone screenshot: `.local/qa/timeline-recorded-phone.png`. The viewport was reset. No account records were edited. Production build passed after the wording change; the final adjustment was CSS-only.
