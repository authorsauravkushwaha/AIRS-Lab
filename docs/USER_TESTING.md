# Real-user testing protocol

Status: no external participants yet. Do not fabricate names, testimonials, or success rates.

Recruit 3–5 consenting engineers. Explain local storage and ask them not to enter sensitive data. Let participants opt out and request deletion. Record only anonymized participant codes with permission.

Tasks:
1. Start a comparison and identify the leading fixture model.
2. Explain the difference between simulated and live metrics.
3. Locate a privacy failure and describe the grading limitation.
4. Export a run and identify its dataset version.
5. Submit feedback via the dashboard.

Capture task success, elapsed time, confusion, and participant comments. Report the sample size, date, recruitment method, incomplete tasks, and changes made. The local `feedback` SQLite table stores actual submitted ratings/comments; it is not a representative study and is not exposed through a public read API. Keep consent and personally identifying information outside Git. Publish only aggregate or consented anonymized findings.

| Date | Anonymous code | Tasks completed | Main issue | Change / retest |
|---|---|---|---|---|
| Pending | — | — | — | — |
