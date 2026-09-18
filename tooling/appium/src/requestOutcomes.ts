export const REQUEST_OUTCOME_LOADED = 'Request outcome: loaded';
export const REQUEST_OUTCOME_NO_FILL = 'Request outcome: no-fill';
export const REQUEST_OUTCOME_ERROR = 'Request error:';

export type RequestOutcome = 'pending' | 'loaded' | 'no-fill' | 'error';

export function requestOutcomeFromText(text: string): RequestOutcome {
  if (text.includes(REQUEST_OUTCOME_LOADED)) {
    return 'loaded';
  }
  if (text.includes(REQUEST_OUTCOME_NO_FILL)) {
    return 'no-fill';
  }
  if (text.includes(REQUEST_OUTCOME_ERROR)) {
    return 'error';
  }
  return 'pending';
}

export function acceptRepresentativeRequestOutcome(
  formatId: string,
  text: string,
  warn: (message: string) => void = console.warn,
): boolean {
  const outcome = requestOutcomeFromText(text);
  if (outcome === 'loaded') {
    return true;
  }
  if (outcome === 'no-fill') {
    warn(`[request-outcome] ${formatId}: SDK no-fill accepted`);
    return true;
  }
  if (outcome === 'error') {
    throw new Error(`[request-outcome] ${formatId}: ${text}`);
  }
  return false;
}
