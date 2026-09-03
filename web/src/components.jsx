import { useEffect, useRef } from 'react';

// Presentational pieces of the Pillar 9 console. Kept in one module so the built
// single-file bundle stays small and easy to read.

/** The gold V that separates sections on pillarnine.com. */
export function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden="true">
      <polygon className="chev-fill" points="0,0 1200,0 1200,10 600,52 0,10" />
      <polyline className="chev-line" points="0,8 600,50 1200,8" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="wordmark">
      <b>PILLAR <i>9</i><sup>™</sup></b>
      <small>TECHNOLOGIES</small>
    </div>
  );
}

export function Badge({ tone = '', children }) {
  return <div className={`badge ${tone}`}><i />{children}</div>;
}

export function Panel({ title, sub, aside, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Rows({ rows }) {
  return (
    <div className="rows">
      {rows.map(([label, value]) => (
        <div className="row" key={label}><span>{label}</span><strong>{value}</strong></div>
      ))}
    </div>
  );
}

const TONE = {
  COMPLETED_ACTION: 'ok',
  FOLLOW_UP_REQUIRED: 'warn',
  NO_CONTACT_MADE: 'warn',
  DO_NOT_CONTACT: 'stop',
  NOT_INTERESTED: 'stop'
};

export function Activity({ items }) {
  if (!items.length) {
    return <div className="empty">No live dispatch or webhook activity yet.</div>;
  }
  return (
    <div className="events">
      {items.map((item, index) => {
        const disposition = item.disposition || 'dispatched';
        return (
          <article className="event" key={`${item.providerCallId || 'row'}-${index}`}>
            <div className="event-top">
              <b>{(item.direction || 'call').toUpperCase()} · {item.mode || 'general'}</b>
              <time>{new Date(item.createdAt).toLocaleString()}</time>
            </div>
            <p>
              <span className={`tag ${TONE[disposition] || ''}`}>{disposition}</span>
              {item.summary || ''}
            </p>
          </article>
        );
      })}
    </div>
  );
}

/** Live call transcript. Streams while a call is in progress, freezes when it ends. */
export function LiveTranscript({ call, onClear }) {
  const bodyRef = useRef(null);
  const live = call?.status === 'live';

  // Keep the newest turn in view, but only while the call is still running so a
  // reader scrolling back through a finished call is not yanked to the bottom.
  useEffect(() => {
    if (live && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [call?.turns?.length, live]);

  if (!call) {
    return <div className="empty">No call in progress. The transcript appears here while a call is live.</div>;
  }
  const who = call.firstName || call.toNumber || call.callId;
  return (
    <>
      <div className="live-head">
        {live && <span className="live-dot" />}
        <span className="live-meta">{live ? `Live · ${who}` : `Ended · ${who}`}</span>
      </div>

      {call.turns.length === 0
        ? <div className="empty" style={{ marginTop: 14 }}>Connected. Waiting for the first words…</div>
        : (
          <div className="transcript" ref={bodyRef}>
            {call.turns.map((turn, index) => (
              <div className={`turn ${turn.role}`} key={index}>
                <b>{turn.role === 'user' ? 'Caller' : 'Ava'}</b>
                <p>{turn.content}</p>
              </div>
            ))}
          </div>
        )}

      {!live && (
        <>
          {call.summary && <div className="ended-note">{call.summary}</div>}
          <div className="actions">
            <button className="btn ghost" type="button" onClick={onClear}>Clear transcript</button>
          </div>
        </>
      )}
    </>
  );
}

/** Light/dark switch. Stored per browser; falls back to the OS setting. */
export function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark';
  return (
    <button className="theme-toggle" type="button" onClick={onToggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} title={`Switch to ${dark ? 'light' : 'dark'} theme`}>
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" /></svg>
      )}
      <span>{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
