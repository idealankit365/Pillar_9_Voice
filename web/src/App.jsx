import { useCallback, useEffect, useState } from 'react';
import { api, savedKey, rememberKey } from './api.js';
import { Activity, Badge, Chevron, LiveTranscript, Panel, Rows, ThemeToggle, Wordmark } from './components.jsx';

const DEMO_MODE = 'buyer_followup';
const THEME_STORE = 'p9_theme';

// A stored choice wins; otherwise follow the OS. Pillar 9 is a dark-first brand, so
// dark is the fallback when neither is available.
function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORE);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch { return 'dark'; }
}

export default function App() {
  const [key, setKey] = useState(savedKey);
  const [status, setStatus] = useState(null);
  const [connection, setConnection] = useState({ text: 'Enter the demo console key to connect.', tone: '' });
  const [items, setItems] = useState([]);
  const [result, setResult] = useState('No action yet.');
  const [firstName, setFirstName] = useState('Jordan');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveCall, setLiveCall] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_STORE, theme); } catch { /* private mode */ }
  }, [theme]);

  const show = (value) => setResult(typeof value === 'string' ? value : JSON.stringify(value, null, 2));

  const loadActivity = useCallback(async (activeKey) => {
    try { setItems((await api('/demo-api/interactions?limit=12', activeKey)).interactions); } catch { /* surfaced elsewhere */ }
  }, []);

  const connect = useCallback(async (activeKey = key) => {
    if (!activeKey) { setConnection({ text: 'Enter the demo console key first.', tone: 'warn' }); return; }
    try {
      rememberKey(activeKey);
      const next = await api('/demo-api/status', activeKey);
      setStatus(next);
      setConnection({ text: 'Connected. Provider and administrator keys remain server-side.', tone: 'good' });
      await loadActivity(activeKey);
    } catch (error) {
      setStatus(null);
      setConnection({ text: `${error.code ? error.code + ': ' : ''}${error.message}`, tone: 'warn' });
    }
  }, [key, loadActivity]);

  useEffect(() => { if (savedKey()) connect(savedKey()); /* eslint-disable-next-line */ }, []);

  // Poll for the live transcript: briskly while a call is up, lazily when idle.
  useEffect(() => {
    if (!status || !key) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await api('/demo-api/live', key);
        if (!cancelled) setLiveCall(next.call);
      } catch { /* transient; the next tick retries */ }
    };
    tick();
    const timer = setInterval(tick, liveCall?.status === 'live' ? 1500 : 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [status, key, liveCall?.status]);

  // A finished call stays on screen until dismissed; a new call clears the dismissal.
  const shownCall = liveCall && liveCall.callId !== dismissed ? liveCall : null;

  const live = status ? !status.voice.dryRun : false;

  async function submit(event) {
    event.preventDefault();
    if (!status) { show('Connect to the backend first.'); return; }
    if (!firstName.trim() || !phone.trim()) { show('First name and phone number are required.'); return; }
    const attestation = `${live ? 'Place a BILLABLE LIVE call' : 'Preview a call'} to ${phone}?\n\n`
      + 'By continuing you confirm this person expressly consented to a voice call for this purpose '
      + 'and the evidence is available.';
    if (!window.confirm(attestation)) {
      show({ blocked: true, code: 'OPERATOR_CONSENT_CONFIRMATION_REQUIRED', message: 'Consent attestation was not given; nothing was sent.' });
      return;
    }
    setBusy(true);
    show('Running contact, consent, compliance and calling-window checks…');
    try {
      show(await api('/demo-api/outbound', key, {
        method: 'POST',
        body: JSON.stringify({ firstName: firstName.trim(), phone: phone.trim(), mode: DEMO_MODE, consentConfirmed: true, liveConfirmed: live })
      }));
      await loadActivity(key);
    } catch (error) {
      show({ ok: false, error: { code: error.code || 'REQUEST_FAILED', message: error.message } });
    } finally { setBusy(false); }
  }

  async function configureInbound() {
    if (live && !window.confirm('This will rebind the live inbound number to this agent. Continue?')) return;
    setBusy(true);
    try { show(await api('/demo-api/inbound/configure', key, { method: 'POST', body: JSON.stringify({ liveConfirmed: live }) })); }
    catch (error) { show({ ok: false, error: { code: error.code || 'REQUEST_FAILED', message: error.message } }); }
    finally { setBusy(false); }
  }

  const modeLabel = status?.modes?.[DEMO_MODE]?.label || DEMO_MODE;
  const inbound = status?.voice?.inboundNumber || '';

  return (
    <>
      <nav className="nav">
        <div className="nav-in">
          <div className="nav-left">
            <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} />
            <span>Internal demonstration</span>
          </div>
          <Wordmark />
          <div className="nav-right">
            <div className="keyrow">
              <input type="password" autoComplete="off" placeholder="Demo key" aria-label="Demo console key"
                value={key} onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') connect(); }} />
              <button className="skew" type="button" onClick={() => connect()}><span>Connect</span></button>
            </div>
          </div>
        </div>
      </nav>

      <header className="hero">
        <p className="kicker">Voice Demo Console</p>
        <h1>Pillar 9 Voice Demo Console</h1>
        <p>One controlled screen for outbound previews and inbound-number setup.</p>
      </header>
      <Chevron />

      <main className="page">
        <div className="wrap">
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
            <Badge tone={status ? (live ? 'warn' : 'good') : ''}>
              {status ? (live ? 'Live — billable calls' : 'Dry run — no call sent') : 'Not connected'}
            </Badge>
            <div className={`notice ${connection.tone}`} style={{ flex: 1, minWidth: 260 }}>{connection.text}</div>
          </div>

          <div className="cols">
            <div className="col">
              <Panel title="Outbound call" sub="Enter a name and number. Consent, do-not-contact, compliance and calling-window checks all still run before dialing.">
                <form onSubmit={submit}>
                  <div className="fields">
                    <div>
                      <label htmlFor="firstName">First name</label>
                      <input id="firstName" required maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="phone">Destination number (E.164)</label>
                      <input id="phone" required inputMode="tel" placeholder="+14035550123" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <p className="hint">
                    {status ? `${live ? 'Billable live call. ' : 'Preview only. '}${modeLabel} · calling window uses the timezone of the number you enter` : 'Connect to enable dialling.'}
                  </p>
                  <div className="actions">
                    <button className="btn" type="submit" disabled={!status || busy}>
                      {live ? 'Place outbound call' : 'Preview outbound call'}
                    </button>
                  </div>
                </form>
              </Panel>

              <Panel title="Latest result">
                <pre>{result}</pre>
              </Panel>

              <Panel title="Recent call activity" sub="Live dispatches and signed provider webhook outcomes appear here."
                aside={<button className="btn ghost" type="button" disabled={!status} onClick={() => loadActivity(key)}>Refresh</button>}>
                <div className="events-scroll"><Activity items={items} /></div>
              </Panel>
            </div>

            <div className="col">
              <Panel title="Live transcript" sub="Streams while a call is in progress and freezes when it ends.">
                <LiveTranscript call={shownCall} onClear={() => setDismissed(liveCall?.callId ?? null)} />
              </Panel>

              <Panel title="Runtime status" sub="Safe configuration summary; credentials are never returned.">
                {status ? (
                  <Rows rows={[
                    ['Environment', status.environment],
                    ['Provider', status.provider],
                    ['Voice', status.provider === 'retell' ? status.retell.voiceId : status.bland.voice],
                    ['From number', status.voice.fromNumber || 'not set'],
                    ['Matrix', status.matrix.mode],
                    ['Properties', Number(status.data.listingCount).toLocaleString()],
                    ['Recording', status.voice.recordCalls ? 'Consent gated' : 'Off']
                  ]} />
                ) : <div className="empty">Connect to load status.</div>}
                <p className="foot">Fixture listings are synthetic training data—not real Matrix listings, prices, addresses or availability.</p>
              </Panel>

              <Panel title="Inbound call" sub="A caller dials the assigned Canadian number. The button applies the approved inbound prompt, tools, transfer routes and webhook.">
                <div style={{ marginTop: 18 }}>
                  <label htmlFor="inboundNumber">Assigned inbound number</label>
                  <input id="inboundNumber" readOnly value={inbound || 'Not connected'} />
                </div>
                <div className="actions">
                  <button className="btn" type="button" disabled={!inbound || busy} onClick={configureInbound}>Configure inbound</button>
                  <button className="btn ghost" type="button" disabled={!inbound}
                    onClick={() => navigator.clipboard?.writeText(inbound)}>Copy</button>
                </div>
                <p className="foot">Numbers are acquired and approved outside this page. Billable number purchase is intentionally excluded from the demo console.</p>
              </Panel>

            </div>
          </div>

          <p className="foot">
            Internal demonstration only. Automation disclosure, consent, DNC, contact-local calling windows,
            purpose limits, recording controls and licensed-human handoffs remain mandatory.
          </p>
        </div>
      </main>
    </>
  );
}
