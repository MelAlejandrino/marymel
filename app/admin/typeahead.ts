export type Option = { value: string; label: string };

/**
 * The option a run of typed letters lands on, searching after `from` first and
 * wrapping to the start, so typing "l" repeatedly cycles the L's rather than
 * sticking on the first one. -1 when nothing matches.
 *
 * Plain .ts, apart from the component, because the test runner strips types but
 * cannot parse JSX.
 */
export function nextMatch(options: Option[], text: string, from: number): number {
  const starts = (o: Option) => o.label.toLowerCase().startsWith(text);
  const after = options.findIndex((o, i) => i > from && starts(o));
  return after === -1 ? options.findIndex(starts) : after;
}
