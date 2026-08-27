import { useState } from 'react';
import type { FormEvent } from 'react';

import type { ApiError } from '../../api/client';
import { BlueprintPanel } from '../BlueprintPanel';
import './AskPortwatch.css';

export interface AskPortwatchProps {
  /**
   * Called with the trimmed question and — only when an incident is selected —
   * its `incident_id` as an optional hint. Never blocked by a selection.
   */
  onSubmit: (q: string, incidentId?: string) => void;
  /** The current answer string to render verbatim, or `null`. */
  answer: string | null;
  /** `true` while a query is in flight. */
  submitting: boolean;
  /** The last query failure, or `null`. */
  error: ApiError | null;
  /** The selected incident id, passed through as an optional hint. */
  selectedIncidentId?: string | null;
  /** Suggestion chips. Falls back to {@link DEFAULT_SUGGESTIONS} when omitted. */
  suggestions?: string[];
}

/** Default suggestion chips when the `suggestions` prop is omitted. */
export const DEFAULT_SUGGESTIONS: string[] = [
  "Where's MSC Anna?",
  'Any incidents awaiting approval?',
  "What's blocked by the kill switch?",
];

/**
 * AskPortwatch — the read-only natural-language query surface in the Live
 * Console right column (Story 2.6, UX-DR6 / FR12 / UJ-2).
 *
 * A free-text input, a primary "Ask" button, and ghost-style suggestion chips.
 * Submitting (Enter, button, or chip) calls `onSubmit(trimmedQ, hint?)`. The
 * query is always usable standalone — it never requires an incident selection;
 * a selected `incident_id` is passed through as an optional hint only.
 *
 * The component NEVER synthesises an incident status: it renders the backend
 * `answer` string verbatim in an `accent-100` bubble inside an
 * `aria-live="polite"` region, and on transport failure shows a plain error
 * line instead.
 *
 * Styling-signal-free in TSX (className only) so it is exempt from the
 * token-consumer lint; all visual values live in AskPortwatch.css via tokens.
 */
export function AskPortwatch({
  onSubmit,
  answer,
  submitting,
  error,
  selectedIncidentId,
  suggestions,
}: AskPortwatchProps) {
  const [value, setValue] = useState('');
  const chips = suggestions ?? DEFAULT_SUGGESTIONS;

  function runSubmit(raw: string) {
    const q = raw.trim();
    if (q === '' || submitting) return;
    onSubmit(q, selectedIncidentId ? selectedIncidentId : undefined);
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSubmit(value);
  }

  function handleChipClick(text: string) {
    // A chip click mid-request must not overwrite typed text.
    if (submitting) return;
    setValue(text);
    runSubmit(text);
  }

  return (
    <BlueprintPanel as="section" className="ask-portwatch" aria-label="Ask Portwatch">
      <h3 className="ask-portwatch__heading">Ask Portwatch</h3>

      <form
        className="ask-portwatch__form"
        onSubmit={handleFormSubmit}
        aria-busy={submitting}
      >
        <input
          className="ask-portwatch__input"
          type="text"
          aria-label="Ask about any incident"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={submitting}
        />
        <button
          className="ask-portwatch__submit"
          type="submit"
          disabled={submitting}
        >
          Ask
        </button>
      </form>

      <div className="ask-portwatch__chips">
        {chips.map((chip, i) => (
          <button
            key={`${i}-${chip}`}
            className="ask-portwatch__chip"
            type="button"
            onClick={() => handleChipClick(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      <div
        className="ask-portwatch__answer-region"
        aria-live="polite"
        aria-atomic="true"
      >
        {submitting && <p className="ask-portwatch__status">Asking…</p>}
        {error != null ? (
          <p className="ask-portwatch__error">Couldn&apos;t reach Portwatch — try again.</p>
        ) : answer != null ? (
          <div className="ask-portwatch__answer">{answer}</div>
        ) : null}
      </div>
    </BlueprintPanel>
  );
}

