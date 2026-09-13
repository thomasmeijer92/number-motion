import { useRef } from 'react';

export function CharacterInput({ id, value, state, onChange }) {
  const composing = useRef(false);
  const hintId = `character-hint-${id}`, errorId = `character-error-${id}`;
  return <div className="character-control">
    <div className="section-label"><label htmlFor={`character-${id}`}>Character</label><span>Choose one character</span></div>
    <input id={`character-${id}`} className="character-input" type="text" value={value}
      aria-invalid={Boolean(state.error)} aria-describedby={`${hintId}${state.error ? ` ${errorId}` : ''}`}
      autoComplete="off" autoCapitalize="off" spellCheck={false}
      onCompositionStart={event => { composing.current = true; onChange(event.currentTarget.value, true); }}
      onCompositionEnd={event => { composing.current = false; onChange(event.currentTarget.value, false); }}
      onChange={event => onChange(event.currentTarget.value, composing.current || Boolean(event.nativeEvent.isComposing))} />
    <p id={hintId} className="character-hint">Inter Medium · letter, digit or symbol</p>
    {state.composing && <p className="character-hint" role="status">Finish entering your character to continue.</p>}
    {state.error && <p id={errorId} className="character-error" role="alert">{state.error}</p>}
    <div className="digit-picker" aria-label="Quick digit selection">{Array.from({ length: 10 }, (_, i) => <button
      type="button" key={i} aria-label={`Digit ${i}`} aria-pressed={!state.blocked && state.character === String(i)}
      className={!state.blocked && state.character === String(i) ? 'selected' : ''}
      onClick={() => { composing.current = false; onChange(String(i), false); }}>{i}</button>)}</div>
  </div>;
}
