import { useState, useRef, useEffect, useCallback } from 'react';
import { PlayIcon, PauseIcon, PlusIcon, DownloadSimpleIcon, ArrowCounterClockwiseIcon, ArrowClockwiseIcon, CopyIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, XIcon, CheckIcon, UploadSimpleIcon, ArrowsClockwiseIcon, GridFourIcon, CaretDownIcon } from '@phosphor-icons/react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/inter/500.css';
import { EFFECTS, PALETTES, SOURCE_DURATION, renderScene, renderProject, getTotalDuration, getLoopTime } from './renderer.js';
import { exportVideo } from './export.js';
import { loadGlyphs, hasGlyphs } from './glyphs.js';
import { CharacterInput } from './CharacterInput.jsx';
import { characterSetKey, inspectCharacterDraft, nextCharacter } from './characters.js';
import { STORAGE_KEY, uid, loadProjectState, validateProject, dimensions, videoDimensions } from './project.js';

const seconds = n => `${n.toFixed(2).replace('.', ',')} s`;
const IconButton = ({ label, children, ...props }) => <button className="icon-button" type="button" title={label} aria-label={label} {...props}>{children}</button>;
function ColorInput({ label, value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <label className="color-field"><span>{label}</span><div className="color-entry"><input type="color" aria-label={`${label} kiezen`} value={value} onChange={e => onChange(e.target.value)} /><input aria-label={`${label} hexcode`} spellCheck={false} maxLength={7} value={draft.toUpperCase()} onChange={e => { setDraft(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value); }} onBlur={() => setDraft(value)} /></div></label>;
}

function DurationInput({ id, value, onChange }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const finish = () => { const parsed = Number(draft.replace(',', '.')); if (Number.isFinite(parsed) && draft.trim()) { const duration = Math.max(0.2, Math.min(10, parsed)); setDraft(String(duration)); onChange(duration); } else setDraft(String(value)); };
  return <input id={id} type="text" inputMode="decimal" aria-label="Duur van dit blok" value={draft} onChange={event => setDraft(event.target.value)} onBlur={finish} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}


function BlockPreview({ scene, ratio, ready, assetError, inputBlocked, playing, onPlay, index }) {
  const canvasRef = useRef(null);
  const [localTime, setLocalTime] = useState(scene.duration * 0.45);
  const timeRef = useRef(localTime);
  useEffect(() => { setLocalTime(t => Math.min(t, scene.duration - 0.001)); }, [scene.duration]);
  useEffect(() => { timeRef.current = localTime; }, [localTime]);
  useEffect(() => {
    if (!playing) return;
    let raf; let previous = performance.now();
    const frame = now => { const dt = (now - previous) / 1000; previous = now; timeRef.current = (timeRef.current + dt) % scene.duration; setLocalTime(timeRef.current); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, [playing, scene.duration]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !ready) return;
    const size = dimensions(ratio, 1100);
    if (canvas.width !== size.width || canvas.height !== size.height) { canvas.width = size.width; canvas.height = size.height; }
    renderScene(canvas.getContext('2d'), scene, localTime, size.width, size.height);
  }, [scene, ratio, ready, localTime, renderScene]);
  return <div className="block-preview-area">
    <div className={`block-stage-container ratio-${ratio.replace(':', '-')}`}><div className="block-stage" style={{ aspectRatio: ratio.replace(':', '/') }}><canvas ref={canvasRef} aria-label={`Voorbeeld blok ${index + 1}: ${scene.digit}, ${EFFECTS.find(effect => effect.id === scene.effect)?.label}`} style={{ background: scene.bg }} />{!ready && <span className="loading-label">{inputBlocked ? 'Controleer de tekeninvoer' : assetError ? 'Tekens niet geladen' : 'Tekens laden…'}</span>}</div></div>
    <div className="block-transport"><button className="play-button" aria-label={`${playing ? 'Pauzeer' : 'Speel'} blok ${index + 1}`} disabled={!ready} onClick={onPlay}>{playing ? <PauseIcon size={17} weight="fill" /> : <PlayIcon size={17} weight="fill" />}</button><input aria-label={`Tijdlijn blok ${index + 1}`} type="range" min="0" max={scene.duration - 0.001} step="0.001" value={localTime} onChange={e => { if (playing) onPlay(); setLocalTime(Number(e.target.value)); }} /><span className="block-timecode">{localTime.toFixed(2)} <span>/ {scene.duration.toFixed(2)} s</span></span><span className="block-loop" title="Alleen dit blok wordt herhaald"><ArrowsClockwiseIcon size={13} /> Dit blok</span></div>
  </div>;
}

export function App() {
  const [initialState] = useState(loadProjectState);
  const [project, setProject] = useState(initialState.project);
  const [recoveryRaw, setRecoveryRaw] = useState(initialState.recoveryRaw);
  const [storageReadError, setStorageReadError] = useState(initialState.storageError);
  const [selectedId, setSelectedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [characterDrafts, setCharacterDrafts] = useState({});
  const [assetState, setAssetState] = useState({ key: null, status: 'loading', error: '' });
  const [assetAttempt, setAssetAttempt] = useState(0);
  const [saveState, setSaveState] = useState('Lokaal bewaard');
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState({ past: [], future: [] });
  const [exportOpen, setExportOpen] = useState(false);
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState(1080);
  const [loops, setLoops] = useState(1);
  const [exportState, setExportState] = useState({ status: 'idle', progress: 0 });
  const projectRef = useRef(project);
  const uploadRef = useRef(null);
  const exportDialogRef = useRef(null);
  const abortRef = useRef(null);
  const resultUrlRef = useRef(null);
  const duration = getTotalDuration(project.scenes);
  const outSize = videoDimensions(project.ratio, quality);
  const busy = exportState.status === 'rendering';
  const exportTooLong = duration * loops > 300;
  const currentCharacters = project.scenes.map(scene => scene.digit);
  const characterKey = characterSetKey(currentCharacters);
  const draftFor = scene => characterDrafts[scene.id] || { value: scene.digit, composing: false };
  const draftStateFor = scene => { const draft = draftFor(scene); return inspectCharacterDraft(draft.value, draft.composing); };
  const inputBlocked = project.scenes.some(scene => {
    const state = draftStateFor(scene);
    return state.blocked || state.character !== scene.digit;
  });
  // Compare keys during render: effects run later, so an old ready=true must
  // never permit a newly edited/imported character to draw before its mask exists.
  const ready = !inputBlocked && assetState.key === characterKey
    && assetState.status === 'ready' && hasGlyphs(currentCharacters);
  const assetError = assetState.key === characterKey ? assetState.error : '';

  const prepareAssets = () => setAssetAttempt(attempt => attempt + 1);
  useEffect(() => {
    let current = true;
    setAssetState({ key: characterKey, status: 'loading', error: '' });
    loadGlyphs(JSON.parse(characterKey)).then(() => {
      if (current) setAssetState({ key: characterKey, status: 'ready', error: '' });
    }).catch(error => {
      if (current) setAssetState({ key: characterKey, status: 'error', error: error.message || 'De tekens konden niet worden geladen.' });
    });
    return () => { current = false; };
  }, [characterKey, assetAttempt]);
  useEffect(() => { if (!ready) setPlayingId(null); }, [ready]);
  useEffect(() => {
    projectRef.current = project;
    if (recoveryRaw !== null) { setSaveState('Oorspronkelijk project bewaard'); return; }
    if (storageReadError !== null) { setSaveState('Opslag niet gelezen · download je project'); return; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); setSaveState('Lokaal bewaard'); }
    catch { setSaveState('Opslag niet beschikbaar · download je project'); }
  }, [project, recoveryRaw, storageReadError]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => () => { abortRef.current?.abort(); if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current); }, []);
  useEffect(() => { const dialog = exportDialogRef.current; if (exportOpen && !dialog.open) dialog.showModal(); if (!exportOpen && dialog.open) dialog.close(); }, [exportOpen]);
  const commit = useCallback(updater => { const previous = projectRef.current; const next = typeof updater === 'function' ? updater(previous) : updater; if (JSON.stringify(next) === JSON.stringify(previous)) return; setHistory(h => ({ past: [...h.past.slice(-59), previous], future: [] })); projectRef.current = next; setProject(next); }, []);
  function undo() { if (!history.past.length) return; setCharacterDrafts({}); const next = history.past.at(-1); setHistory(h => ({ past: h.past.slice(0, -1), future: [project, ...h.future] })); projectRef.current = next; setProject(next); setPlayingId(null); }
  function redo() { if (!history.future.length) return; setCharacterDrafts({}); const next = history.future[0]; setHistory(h => ({ past: [...h.past, project], future: h.future.slice(1) })); projectRef.current = next; setProject(next); setPlayingId(null); }
  function patchScene(id, patch) { setSelectedId(id); commit(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? { ...s, ...patch } : s) })); }
  function updateCharacter(id, value, composing) {
    const state = inspectCharacterDraft(value, composing);
    setCharacterDrafts(drafts => ({ ...drafts, [id]: { value: state.character ?? value, composing } }));
    setPlayingId(null);
    if (!state.blocked) patchScene(id, { digit: state.character });
  }
  function addScene(afterIndex = project.scenes.length - 1, duplicate = false) {
    if (project.scenes.length >= 60) { setToast('Je kunt maximaal 60 blokken toevoegen.'); return; }
    const source = project.scenes[afterIndex];
    const next = duplicate ? { ...source, id: uid() } : { id: uid(), digit: nextCharacter(source.digit), effect: 'single', bg: PALETTES[(afterIndex + 1) % PALETTES.length].bg, fg: PALETTES[(afterIndex + 1) % PALETTES.length].fg, accent: '#009D8B', duration: 0.45, speed: 1, scale: 1 };
    commit({ ...project, scenes: [...project.scenes.slice(0, afterIndex + 1), next, ...project.scenes.slice(afterIndex + 1)] }); setSelectedId(next.id); setPlayingId(null); setToast(duplicate ? 'Blok gedupliceerd' : 'Nieuw videoblok toegevoegd');
  }
  function deleteScene(id) { if (project.scenes.length === 1) return; setCharacterDrafts(drafts => { const next = { ...drafts }; delete next[id]; return next; }); commit({ ...project, scenes: project.scenes.filter(s => s.id !== id) }); if (playingId === id) setPlayingId(null); }
  function moveScene(index, direction) { const to = index + direction; if (to < 0 || to >= project.scenes.length) return; const scenes = [...project.scenes]; [scenes[index], scenes[to]] = [scenes[to], scenes[index]]; commit({ ...project, scenes }); setSelectedId(scenes[to].id); }
  useEffect(() => {
    function keydown(e) { if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable || exportOpen) return; if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (ready && e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); const id = project.scenes.some(scene => scene.id === selectedId) ? selectedId : project.scenes[0].id; setPlayingId(current => current === id ? null : id); } }
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });
  function downloadProject() { if (inputBlocked) return; const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `${project.name || 'number-motion'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); setToast('Project gedownload'); }
  function downloadRecovery() { const url = URL.createObjectURL(new Blob([recoveryRaw], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'number-motion-herstel.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
  async function importProject(event) { const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 1e6) throw new Error('Dit projectbestand is te groot.'); const next = validateProject(JSON.parse(await file.text())); setCharacterDrafts({}); commit(next); setSelectedId(next.scenes[0].id); setPlayingId(null); setToast(`${next.scenes.length} blokken geïmporteerd`); } catch (error) { setToast(error instanceof SyntaxError ? 'Dit is geen geldig JSON-project.' : error.message); } event.target.value = ''; }
  function openExport() { if (!ready) return; setPlayingId(null); setExportState({ status: 'idle', progress: 0 }); setExportOpen(true); }
  function closeExport() { if (!busy) setExportOpen(false); }
  async function startExport() {
    if (!ready || exportTooLong) return; setPlayingId(null);
    if (resultUrlRef.current) { URL.revokeObjectURL(resultUrlRef.current); resultUrlRef.current = null; }
    const controller = new AbortController(); abortRef.current = controller;
    const snapshot = structuredClone(project); const baseDuration = getTotalDuration(snapshot.scenes);
    setExportState({ status: 'rendering', progress: 0 });
    try {
      await loadGlyphs(snapshot.scenes.map(scene => scene.digit));
      const result = await exportVideo({ ...outSize, duration: baseDuration * loops, fps: 30, format, signal: controller.signal, renderFrame: (ctx, t, width, height) => renderProject(ctx, snapshot.scenes, getLoopTime(t, baseDuration), width, height), onProgress: progress => setExportState({ status: 'rendering', progress }) });
      const url = URL.createObjectURL(result.blob); resultUrlRef.current = url;
      setExportState({ status: 'done', progress: 1, url, filename: `${snapshot.name.replace(/[^a-z0-9_\- ]/gi, '').trim() || 'number-motion'}.${result.extension}`, size: `${(result.blob.size / 1024 / 1024).toFixed(1)} MB` });
    } catch (error) { setExportState(error.name === 'AbortError' ? { status: 'idle', progress: 0 } : { status: 'error', progress: 0, message: error.message || 'Export mislukt. Probeer een lagere resolutie.' }); }
  }

  let blockStart = 0;
  return <div className="app-shell blocks-app">
    <header className="topbar"><a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="Number Motion"><span className="brand-mark"><GridFourIcon size={22} weight="fill" /></span><span>number<span className="brand-light">motion</span><span className="brand-dot">.</span></span></a><span className="app-tag">Eén teken per blok. Jouw video.</span><div className="top-actions"><button className="primary-button" onClick={openExport} disabled={!ready}><DownloadSimpleIcon size={18} weight="bold" /> Exporteer montage</button></div></header>
    <main className="blocks-main"><div className="project-bar"><div className="project-heading"><div className="eyebrow">JOUW VIDEOBLOKKEN</div><input aria-label="Projectnaam" className="project-name" maxLength={60} value={project.name} onChange={e => commit({ ...project, name: e.target.value })} /></div><div className="project-actions"><span className="save-indicator"><span />{inputBlocked ? 'Teken nog niet bewaard' : saveState}</span><div className="history-actions"><IconButton label="Ongedaan maken" disabled={!history.past.length} onClick={undo}><ArrowCounterClockwiseIcon size={18} /></IconButton><IconButton label="Opnieuw" disabled={!history.future.length} onClick={redo}><ArrowClockwiseIcon size={18} /></IconButton></div><IconButton label="Project openen" onClick={() => uploadRef.current.click()}><UploadSimpleIcon size={18} /></IconButton><IconButton label="Project opslaan als JSON" onClick={downloadProject} disabled={inputBlocked}><DownloadSimpleIcon size={18} /></IconButton><input ref={uploadRef} type="file" hidden accept=".json,application/json" onChange={importProject} /></div></div>
      <div className="composition-note"><p>Kies per blok één teken. Het kwartet en de patronen herhalen dat teken. Export plakt de blokken achter elkaar.</p><label className="ratio-picker"><select aria-label="Beeldverhouding" value={project.ratio} onChange={e => commit({ ...project, ratio: e.target.value })}><option value="16:9">16:9 · Liggend</option><option value="1:1">1:1 · Vierkant</option><option value="9:16">9:16 · Staand</option></select><CaretDownIcon size={13} /></label></div>
      {(recoveryRaw !== null || storageReadError !== null) && <div className="project-notice" role="alert"><p>{recoveryRaw !== null ? 'Je bewaarde project kon niet worden geopend. Het oorspronkelijke bestand blijft bewaard totdat je deze versie opslaat.' : 'Je browseropslag kon niet worden gelezen. Automatisch bewaren staat uit. Met “Deze versie bewaren” vervang je het opgeslagen project.'}</p><div><button type="button" className="text-button" disabled={recoveryRaw === null && inputBlocked} onClick={recoveryRaw !== null ? downloadRecovery : downloadProject}>{recoveryRaw !== null ? 'Download bewaard bestand' : 'Download deze versie'}</button><button type="button" className="text-button" disabled={inputBlocked} onClick={() => { setRecoveryRaw(null); setStorageReadError(null); }}>Deze versie bewaren</button></div></div>}
      {assetError && <div className="project-notice" role="alert"><p>{assetError}</p><button type="button" className="text-button" onClick={prepareAssets}>Tekens opnieuw laden</button></div>}
      <div className="blocks-list">{project.scenes.map((scene, index) => { const start = blockStart; blockStart += scene.duration; const end = blockStart; return <section key={scene.id} className={`number-block ${selectedId === scene.id ? 'is-selected' : ''}`} aria-label={`Videoblok ${index + 1}`} onFocusCapture={() => setSelectedId(scene.id)}><header className="block-heading"><div className="block-title-group"><span className="block-label">{String(index + 1).padStart(2, '0')}</span><h2>Teken {scene.digit}</h2><span className="block-timecode">{start.toFixed(2)} – {end.toFixed(2)} s</span></div><div className="block-toolbar"><IconButton label={`Blok ${index + 1} omhoog`} disabled={index === 0} onClick={() => moveScene(index, -1)}><ArrowUpIcon size={16} /></IconButton><IconButton label={`Blok ${index + 1} omlaag`} disabled={index === project.scenes.length - 1} onClick={() => moveScene(index, 1)}><ArrowDownIcon size={16} /></IconButton><IconButton label={`Blok ${index + 1} dupliceren`} disabled={project.scenes.length >= 60} onClick={() => addScene(index, true)}><CopyIcon size={16} /></IconButton><IconButton label={`Blok ${index + 1} verwijderen`} disabled={project.scenes.length === 1} onClick={() => deleteScene(scene.id)}><TrashIcon size={16} /></IconButton></div></header>
        <div className="block-layout"><BlockPreview scene={scene} index={index} ratio={project.ratio} ready={ready} assetError={assetError} inputBlocked={inputBlocked} playing={ready && playingId === scene.id} onPlay={() => { setSelectedId(scene.id); setPlayingId(id => id === scene.id ? null : scene.id); }} /><div className="block-settings">
          <CharacterInput id={scene.id} value={draftFor(scene).value} state={draftStateFor(scene)} onChange={(value, composing) => updateCharacter(scene.id, value, composing)} />
          <div className="block-motion-row"><label className="section-label" htmlFor={`effect-${scene.id}`}><h3>Animatie</h3></label><select id={`effect-${scene.id}`} className="effect-select" aria-label="Type animatie" aria-describedby={`effect-description-${scene.id}`} value={scene.effect} onChange={e => patchScene(scene.id, { effect: e.target.value })}>{EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select>
          <p id={`effect-description-${scene.id}`} className="effect-description">{EFFECTS.find(effect => effect.id === scene.effect)?.description}</p>
          <button type="button" className="reference-tempo" title="Duur en snelheid van de GIF gebruiken" onClick={() => patchScene(scene.id, { duration: SOURCE_DURATION[scene.effect], speed: 1 })}>Referentietempo · {seconds(SOURCE_DURATION[scene.effect])}</button></div>
          <div className="block-colors"><ColorInput label="Achtergrond" value={scene.bg} onChange={bg => patchScene(scene.id, { bg })} /><ColorInput label="Tekenkleur" value={scene.fg} onChange={fg => patchScene(scene.id, { fg })} /><IconButton label="Kleuren wisselen" onClick={() => patchScene(scene.id, { bg: scene.fg, fg: scene.bg })}><ArrowsClockwiseIcon size={16} /></IconButton></div>
          <div className="block-duration-row"><label htmlFor={`duration-${scene.id}`}>Duur van dit blok</label><div className="number-field"><DurationInput key={scene.id} id={`duration-${scene.id}`} value={scene.duration} onChange={duration => patchScene(scene.id, { duration })} /><span>sec</span></div></div>
          <div className="block-bottom-controls"><div><label className="slider-label" htmlFor={`speed-${scene.id}`}>Snelheid <span>{Number(scene.speed.toFixed(2)).toString().replace('.', ',')}×</span></label><input id={`speed-${scene.id}`} aria-label="Snelheid" type="range" min="0.25" max="3" step="0.05" value={scene.speed} onChange={e => patchScene(scene.id, { speed: Number(e.target.value) })} /></div><div><label className="slider-label" htmlFor={`scale-${scene.id}`}>Grootte <span>{Math.round(scene.scale * 100)}%</span></label><input id={`scale-${scene.id}`} aria-label="Grootte" type="range" min="0.5" max="1.5" step="0.01" value={scene.scale} onChange={e => patchScene(scene.id, { scale: Number(e.target.value) })} /></div></div>
        </div></div></section>; })}</div>
      <button className="block-add" onClick={() => addScene()} disabled={project.scenes.length >= 60}><PlusIcon size={22} /><span>Videoblok toevoegen</span></button><div className="blocks-summary"><span>{project.scenes.length} blokken → één video van {seconds(duration)}</span><button className="primary-button" onClick={openExport} disabled={!ready}><DownloadSimpleIcon size={17} /> Exporteer montage</button></div><footer className="app-footer"><span>Gemaakt om mee te spelen.</span><span>Alles blijft in je browser · Geen account nodig</span></footer>
    </main>
    <dialog className="export-dialog" ref={exportDialogRef} aria-labelledby="export-title" onCancel={e => { e.preventDefault(); closeExport(); }}><div className="dialog-top"><div className="dialog-icon"><DownloadSimpleIcon size={23} /></div><IconButton label="Export sluiten" onClick={closeExport} disabled={busy}><XIcon size={20} /></IconButton></div><div className="eyebrow">VAN SPELEN NAAR DELEN</div><h2 id="export-title">Maak er een video van.</h2><p className="dialog-intro">Alle videoblokken achter elkaar, in de volgorde hierboven.</p>
      {exportState.status !== 'done' && <><div className="export-settings"><label>Bestandsformaat<select aria-label="Exportformaat" disabled={busy} value={format} onChange={e => setFormat(e.target.value)}><option value="mp4">MP4 · H.264</option><option value="webm">WebM · alternatief</option></select></label><label>Resolutie<select aria-label="Exportresolutie" disabled={busy} value={quality} onChange={e => setQuality(Number(e.target.value))}><option value="1080">1080p · Hoge kwaliteit</option><option value="720">720p · Kleiner bestand</option></select></label><label>Herhalingen<select aria-label="Aantal herhalingen" disabled={busy} value={loops} onChange={e => setLoops(Number(e.target.value))}><option value="1">1× · {seconds(duration)}</option><option value="2">2× · {seconds(duration * 2)}</option><option value="4">4× · {seconds(duration * 4)}</option></select></label></div><div className="export-summary"><span>{outSize.width} × {outSize.height}</span><span>30 fps</span><span>Zonder geluid</span></div>{busy && <div className="export-progress" role="status"><div><span>Je video wordt gemaakt…</span><strong>{Math.round(exportState.progress * 100)}%</strong></div><progress max="1" value={exportState.progress} /><p>Houd dit venster open tot je video klaar is.</p></div>}{exportState.status === 'error' && <p className="error-message" role="alert">{exportState.message}</p>}<p className="error-message" role="alert" hidden={!exportTooLong}>Maximaal 5 minuten per export. Kies minder herhalingen of maak je scènes korter.</p><button className="primary-button export-start" onClick={busy ? () => abortRef.current?.abort() : startExport} disabled={!ready || (!busy && exportTooLong)}>{busy ? 'Export annuleren' : <><DownloadSimpleIcon size={18} /> Maak {format.toUpperCase()}</>}</button></>}
      {exportState.status === 'done' && <div className="export-result"><video controls src={exportState.url} aria-label="Geëxporteerde video" playsInline /><div className="export-ready"><CheckIcon size={17} weight="bold" /><span>Je video is klaar · {exportState.size}</span></div><a className="primary-button export-start" href={exportState.url} download={exportState.filename}><DownloadSimpleIcon size={18} /> Download {format.toUpperCase()}</a><button className="text-button another-export" onClick={() => setExportState({ status: 'idle', progress: 0 })}>Andere exportinstellingen</button></div>}
      <p className="privacy-note">Lokaal gemaakt. Je ontwerp wordt nergens geüpload.</p>
    </dialog>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
