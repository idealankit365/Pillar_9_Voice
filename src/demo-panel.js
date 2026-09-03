import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILT_PANEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist', 'index.html');

const LEGACY_DEMO_PANEL_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Pillar 9 Voice Demo Console</title>
<style>
  *,*::before,*::after{box-sizing:border-box}

  /* ============ TOKENS ============ */
  :root{
    --base:#0b111a; --base-2:#0e1622;
    --panel:rgba(19,28,41,.72); --panel-2:rgba(24,35,50,.62); --chrome:rgba(13,20,30,.86);
    --edge:rgba(148,180,210,.14); --edge-strong:rgba(148,180,210,.24); --hair:rgba(148,180,210,.09);
    --ink:#eef3f8; --ink-2:#aebdcd; --muted:#8ea0b8; --label:#6f84a0; --faint:#4c5f76;
    --accent:#3aa0e8; --btn-a:#1a6aa6; --btn-b:#123a63; --accent-ink:#f4fbff;
    --ok:#31c48d; --warn:#e0a72e; --stop:#e0577a;
    --r:12px; --r-sm:9px; --r-lg:16px;
    --blur:20px;
    color-scheme:dark;
  }
  @media (prefers-color-scheme: light){
    :root{
      --base:#eef2f7; --base-2:#e6ecf3;
      --panel:rgba(255,255,255,.72); --panel-2:rgba(255,255,255,.58); --chrome:rgba(255,255,255,.86);
      --edge:rgba(20,50,90,.10); --edge-strong:rgba(20,50,90,.18); --hair:rgba(20,50,90,.07);
      --ink:#101a26; --ink-2:#3c4f63; --muted:#4f6178; --label:#5b7188; --faint:#8a97a8;
      --accent:#0c72b8; --btn-a:#0c72b8; --btn-b:#0a3f68; --accent-ink:#ffffff;
      --ok:#0a8a5f; --warn:#96660a; --stop:#b8355a;
      color-scheme:light;
    }
  }
  html,body{height:100%}
  body{margin:0;background:var(--base);color:var(--ink);
    font:14.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  ::selection{background:color-mix(in srgb,var(--accent) 35%,transparent)}

  /* ============ QUIET DEPTH FIELD ============
     One slow, low-contrast wash — not a lava lamp. Reads as still water, not a
     marketing hero. Kept subtle enough that no text ever sits on a bright patch. */
  .depth{position:fixed;inset:0;z-index:-2;background:var(--base)}
  .depth::before{content:"";position:absolute;inset:0;
    background:
      radial-gradient(1100px 620px at -6% -12%, color-mix(in srgb,var(--accent) 13%,transparent), transparent 60%),
      radial-gradient(900px 560px at 108% 8%, color-mix(in srgb,var(--accent) 8%,transparent), transparent 62%),
      linear-gradient(180deg, var(--base) 0%, var(--base-2) 100%);
    animation:tide 50s ease-in-out infinite}
  @keyframes tide{0%,100%{opacity:1}50%{opacity:.72}}
  @media (prefers-reduced-motion: reduce){.depth::before{animation:none}}
  .ruled{position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.5;
    background-image:linear-gradient(var(--hair) 1px,transparent 1px),linear-gradient(90deg,var(--hair) 1px,transparent 1px);
    background-size:64px 64px;
    -webkit-mask-image:radial-gradient(1200px 800px at 20% 0%, #000 0%, transparent 72%);
    mask-image:radial-gradient(1200px 800px at 20% 0%, #000 0%, transparent 72%)}

  /* ============ GLASS PRIMITIVES ============ */
  .glass{background:var(--panel);border:1px solid var(--edge);border-radius:var(--r-lg);
    -webkit-backdrop-filter:blur(var(--blur)) saturate(140%);backdrop-filter:blur(var(--blur)) saturate(140%);
    box-shadow:0 1px 0 rgba(255,255,255,.06) inset, 0 20px 44px -26px rgba(0,0,0,.6)}
  @media (prefers-color-scheme: light){.glass{box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 16px 34px -24px rgba(30,50,80,.28)}}

  /* ============ APP FRAME: fixed rail + scrolling content ============ */
  .frame{display:grid;grid-template-columns:272px 1fr;min-height:100vh}
  @media (max-width:880px){.frame{grid-template-columns:1fr}}

  /* ---- rail (chrome, not a card) ---- */
  .rail{position:sticky;top:0;height:100vh;background:var(--chrome);border-right:1px solid var(--edge);
    -webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);
    display:flex;flex-direction:column;padding:22px 18px;gap:22px;overflow-y:auto}
  @media (max-width:880px){.rail{position:relative;height:auto;border-right:none;border-bottom:1px solid var(--edge)}}
  .brand{display:flex;align-items:flex-start;gap:12px;padding-bottom:18px;border-bottom:1px solid var(--hair)}
  .mark{width:38px;height:38px;flex:none;border-radius:10px;display:grid;place-items:center;color:var(--accent-ink);
    font-weight:700;font-size:14px;background:linear-gradient(160deg,var(--btn-a),var(--btn-b));
    box-shadow:0 1px 0 rgba(255,255,255,.35) inset}
  .brand-name{min-width:0}
  .eyebrow{margin:0;font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  h1{margin:3px 0 0;font-size:14px;line-height:1.3;letter-spacing:-.008em;font-weight:660;text-wrap:balance}

  .rail-block{display:flex;flex-direction:column;gap:9px}
  .rail-label{font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--label)}
  .keyrow{display:flex;gap:7px}
  .keyrow input{min-width:0}

  .badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--r-sm);
    font-size:11.5px;font-weight:640;border:1px solid var(--edge);background:var(--panel-2);color:var(--ink-2);width:100%}
  .badge::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--faint);flex:none}
  .badge.good{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 38%,var(--edge))}
  .badge.good::before{background:var(--ok);box-shadow:0 0 8px 0 var(--ok)}
  .badge.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 38%,var(--edge))}
  .badge.warn::before{background:var(--warn);box-shadow:0 0 8px 0 var(--warn)}

  .rail-spacer{flex:1}
  .rail-foot{font-size:10.5px;line-height:1.6;color:var(--label);padding-top:14px;border-top:1px solid var(--hair)}

  /* ---- main content ---- */
  .main{padding:30px 34px 70px;max-width:1460px;min-width:0}
  @media (max-width:640px){.main{padding:22px 16px 56px}}
  .page-head{margin-bottom:24px}
  .kicker{margin:0;font-size:10.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--accent)}
  .page-title{margin:6px 0 0;font-size:21px;font-weight:640;letter-spacing:-.015em;color:var(--ink)}
  .page-sub{margin:6px 0 0;font-size:13px;color:var(--muted);max-width:64ch;line-height:1.55}

  .notice{margin:0;padding:9px 12px;border-radius:var(--r-sm);border:1px solid var(--edge);
    background:var(--panel-2);color:var(--ink-2);font-size:11px;line-height:1.5;display:block}
  .notice.is-good{border-color:color-mix(in srgb,var(--ok) 35%,var(--edge));color:var(--ok)}
  .notice.is-warn{border-color:color-mix(in srgb,var(--warn) 35%,var(--edge));color:var(--warn)}

  /* ---- section panels ---- */
  .panel{border-radius:var(--r-lg);padding:22px;min-width:0}
  /* Two independent column stacks, NOT aligned grid rows. Aligned rows force every
     row to the height of its tallest panel, which left large voids under the short
     ones. Each column now flows at its own natural height. */
  .cols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}
  .col{display:grid;gap:16px;align-content:start;min-width:0}
  @media (max-width:1000px){.cols{grid-template-columns:1fr}}

  .panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:16px}
  h2{margin:0;font-size:10.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-2)}
  .sub{margin:6px 0 0;color:var(--muted);font-size:12px;line-height:1.55;max-width:58ch}

  /* ---- form ---- */
  label{display:block;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
    color:var(--label);margin:0 0 7px}
  input{width:100%;padding:11px 13px;border:1px solid var(--edge);border-radius:var(--r-sm);
    background:var(--base-2);color:var(--ink);font:inherit;font-size:14px;
    transition:border-color .15s,box-shadow .15s}
  @media (prefers-color-scheme: light){input{background:#ffffff}}
  input::placeholder{color:var(--muted)}
  input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
  input:read-only{color:var(--ink-2);font-variant-numeric:tabular-nums;background:var(--panel-2)}
  .fields{display:grid;grid-template-columns:1fr 1.2fr;gap:14px}
  @media (max-width:560px){.fields{grid-template-columns:1fr}}
  .hint{font-size:11px;color:var(--muted);margin-top:9px;line-height:1.5}
  .actions{display:flex;gap:9px;margin-top:18px;flex-wrap:wrap}

  button{appearance:none;border:1px solid transparent;border-radius:var(--r-sm);padding:11px 20px;font:inherit;
    font-size:13px;font-weight:620;cursor:pointer;color:var(--accent-ink);
    background:linear-gradient(160deg,var(--btn-a),var(--btn-b));
    box-shadow:0 1px 0 rgba(255,255,255,.3) inset,0 8px 18px -10px color-mix(in srgb,var(--btn-a) 60%,transparent);
    transition:filter .15s,transform .06s}
  button:hover:not(:disabled){filter:brightness(1.08)}
  button:active:not(:disabled){transform:translateY(1px)}
  button:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 35%,transparent)}
  button:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.3)}
  button.secondary{background:var(--panel-2);color:var(--ink-2);border-color:var(--edge);box-shadow:none}
  button.secondary:hover:not(:disabled){background:var(--panel);color:var(--ink);filter:none;border-color:var(--edge-strong)}
  .cta{width:100%;padding:13px 20px;font-size:13.5px}

  /* ---- result console ---- */
  .result-panel{padding:0;overflow:hidden}
  .result-bar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;
    border-bottom:1px solid var(--hair);background:var(--panel-2)}
  .dots{display:flex;gap:6px}
  .dots i{width:8px;height:8px;border-radius:50%;background:var(--faint);opacity:.5;display:block}
  pre{margin:0;padding:16px;overflow:auto;max-height:300px;background:transparent;color:var(--ink-2);
    font:12px/1.65 ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
    white-space:pre-wrap;word-break:break-word}
  pre::-webkit-scrollbar{width:8px;height:8px}
  pre::-webkit-scrollbar-thumb{background:var(--edge-strong);border-radius:8px}

  /* ---- metric rows ---- */
  .statusbox{display:grid;border:1px solid var(--edge);border-radius:var(--r-sm);overflow:hidden}
  .row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 13px;
    font-size:12px;border-bottom:1px solid var(--hair);background:transparent}
  .row:last-child{border-bottom:none}
  .row span{color:var(--muted);font-size:11px;letter-spacing:.02em}
  .row strong{font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;text-align:right;word-break:break-word}

  /* ---- activity ---- */
  .activity-list{display:grid;gap:9px}
  .event{border:1px solid var(--edge);border-left:2px solid var(--btn-a);border-radius:var(--r-sm);
    padding:12px 15px;background:var(--panel-2)}
  .event-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  .event-top strong{font-size:11px;font-weight:660;letter-spacing:.03em;color:var(--ink)}
  .event-top span{font-size:11px;color:var(--label);font-variant-numeric:tabular-nums}
  .event p{margin:8px 0 0;font-size:12px;color:var(--ink-2);line-height:1.55}
  .pill{display:inline-block;padding:2px 8px;border-radius:5px;font-size:9.5px;font-weight:700;
    letter-spacing:.06em;border:1px solid var(--edge);background:var(--base-2);color:var(--muted);margin-right:8px}
  .pill.ok{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 40%,var(--edge))}
  .pill.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,var(--edge))}
  .pill.stop{color:var(--stop);border-color:color-mix(in srgb,var(--stop) 40%,var(--edge))}
  .empty{padding:26px 16px;text-align:center;color:var(--muted);font-size:12px;
    border:1px dashed var(--edge);border-radius:var(--r-sm)}

  .footer{margin:8px 0 0;color:var(--muted);font-size:11px;line-height:1.6}
  .panel .footer{margin-top:14px;padding-top:13px;border-top:1px solid var(--hair)}
  .page-foot{margin-top:30px;color:var(--label);font-size:10.5px;line-height:1.7;max-width:74ch}
</style>
</head>
<body>
  <div class="depth"></div>
  <div class="ruled"></div>

  <div class="frame">
    <aside class="rail">
      <div class="brand"><div class="mark">P9</div><div class="brand-name"><p class="eyebrow">Internal demonstration</p><h1>Pillar 9 Voice Demo Console</h1></div></div>

      <div class="rail-block">
        <span class="rail-label">Access</span>
        <div class="keyrow"><input id="adminKey" type="password" autocomplete="off" placeholder="Demo key" aria-label="Demo console key"><button id="connectButton" type="button">Go</button></div>
        <div id="connectionMessage" class="notice">Start the Node service, then connect with the development admin key.</div>
      </div>

      <div class="rail-block">
        <span class="rail-label">Mode</span>
        <div id="environmentBadge" class="badge">Not connected</div>
      </div>

      <div class="rail-spacer"></div>
      <p class="rail-foot">Automation disclosure, consent, DNC, contact-local calling windows, purpose limits, recording controls and licensed-human handoffs remain mandatory.</p>
    </aside>

    <main class="main">
      <div class="page-head">
        <p class="kicker">Outbound &amp; inbound console</p>
        <p class="page-title">One controlled screen for outbound previews and inbound-number setup.</p>
      </div>

      <div class="cols">
        <div class="col">
          <section class="glass panel">
            <div class="panel-head"><h2>Outbound call</h2></div>
            <p class="sub">Enter a name and number. Consent, do-not-contact, compliance and calling-window checks all still run before dialing.</p>
            <form id="outboundForm" style="margin-top:18px">
              <div class="fields">
                <div><label for="firstName">First name</label><input id="firstName" required maxlength="80" value="Jordan"></div>
                <div><label for="phone">Destination number (E.164)</label><input id="phone" required inputmode="tel" placeholder="+14035550123"></div>
              </div>
              <div id="callHint" class="hint"></div>
              <div class="actions"><button id="callButton" class="cta" type="submit" disabled>Preview outbound call</button></div>
            </form>
          </section>

          <section class="glass panel result-panel">
            <div class="result-bar"><span class="rail-label">Latest result</span><div class="dots"><i></i><i></i><i></i></div></div>
            <pre id="result">No action yet.</pre>
          </section>

          <section class="glass panel">
            <div class="panel-head"><div><h2>Recent call activity</h2><p class="sub">Live dispatches and signed provider webhook outcomes appear here.</p></div><button id="refreshActivity" class="secondary" type="button" disabled>Refresh</button></div>
            <div id="activityList" class="activity-list"><div class="empty">No activity loaded.</div></div>
          </section>
        </div>

        <div class="col">
          <section class="glass panel">
            <div class="panel-head"><h2>Runtime status</h2></div>
            <p class="sub">Safe configuration summary; credentials are never returned.</p>
            <div id="runtimeStatus" class="statusbox" style="margin-top:16px"><div class="empty">Connect to load status.</div></div>
            <p class="footer">Fixture listings are synthetic training data—not real Matrix listings, prices, addresses or availability.</p>
          </section>

          <section class="glass panel">
            <div class="panel-head"><h2>Inbound call</h2></div>
            <p class="sub">A caller dials the assigned Canadian number. The button applies the approved inbound prompt, tools, transfer routes and webhook.</p>
            <div style="margin-top:16px"><label for="inboundNumber">Assigned inbound number</label><input id="inboundNumber" readonly value="Not connected"></div>
            <div class="actions"><button id="configureInbound" type="button" disabled>Configure inbound</button><button id="copyNumber" class="secondary" type="button" disabled>Copy</button></div>
            <p class="footer">Numbers are acquired and approved outside this page. Billable number purchase is intentionally excluded from the demo console.</p>
          </section>
        </div>
      </div>

      <p class="page-foot">Internal demonstration only.</p>
    </main>
  </div>

  <script>
    (function(){
      'use strict';
      var state={status:null,modes:{}};
      var $=function(id){return document.getElementById(id);};
      var result=$('result');
      $('adminKey').value=sessionStorage.getItem('p9_demo_admin_key')||'';

      function setResult(value){result.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);}
      var DEMO_MODE='buyer_followup';
      function setConnection(message,kind){var box=$('connectionMessage');box.textContent=message;box.className='notice '+(kind==='good'?'is-good':'is-warn');}
      function adminKey(){return $('adminKey').value.trim();}
      async function api(path,options){options=options||{};var headers=Object.assign({'x-p9-demo-key':adminKey()},options.headers||{});if(options.body)headers['content-type']='application/json';var response=await fetch(path,Object.assign({},options,{headers:headers}));var body=await response.json().catch(function(){return{ok:false,error:{message:'Backend returned an unreadable response.'}};});if(!response.ok||!body.ok){var error=new Error(body.error&&body.error.message||'Request failed.');error.code=body.error&&body.error.code;error.status=response.status;throw error;}return body.data;}
      function row(label,value){var wrap=document.createElement('div');wrap.className='row';var left=document.createElement('span');left.textContent=label;var right=document.createElement('strong');right.textContent=value;wrap.append(left,right);return wrap;}
      function renderStatus(status){
        var badge=$('environmentBadge');badge.textContent=status.voice.dryRun?'DRY RUN — no call sent':'LIVE — billable calls';badge.className='badge '+(status.voice.dryRun?'good':'warn');
        var box=$('runtimeStatus');box.replaceChildren(row('Environment',status.environment),row('Provider',status.provider),row('Voice',status.provider==='retell'?status.retell.voiceId:status.bland.voice),row('From number',status.voice.fromNumber||'not set'),row('Matrix',status.matrix.mode),row('Properties',String(status.data.listingCount)),row('Recording',status.voice.recordCalls?'Consent gated':'Off'));
        $('inboundNumber').value=status.voice.inboundNumber||(status.provider==='retell'?'Set RETELL_INBOUND_NUMBER':'Set BLAND_INBOUND_NUMBER');
        $('configureInbound').disabled=!status.voice.inboundNumber;
        $('copyNumber').disabled=!status.voice.inboundNumber;
        $('callButton').disabled=false;$('refreshActivity').disabled=false;
        $('callButton').textContent=status.voice.dryRun?'Preview outbound call':'Place outbound call';
        var label=state.modes&&state.modes[DEMO_MODE]?state.modes[DEMO_MODE].label:DEMO_MODE;
        $('callHint').textContent=(status.voice.dryRun?'Preview only. ':'Billable live call. ')+label+' · calling window uses the timezone of the number you enter';
      }
      async function connect(){
        if(!adminKey()){setConnection('Enter ADMIN_API_KEY first.','warn');return;}
        try{sessionStorage.setItem('p9_demo_admin_key',adminKey());var status=await api('/demo-api/status');state.status=status;state.modes=status.modes;renderStatus(status);setConnection('Connected. Provider and administrator keys remain server-side.','good');await loadActivity();}
        catch(error){setConnection((error.code?error.code+': ':'')+error.message,'warn');setResult({error:error.code||'CONNECT_FAILED',message:error.message});}
      }
      function contactId(phone){var digits=phone.replace(/\D/g,'');return 'demo_'+digits.slice(-10);}
      async function submitOutbound(event){
        event.preventDefault();if(!state.status){setResult('Connect to the backend first.');return;}
        var phone=$('phone').value.trim();var firstName=$('firstName').value.trim();
        if(!phone||!firstName){setResult('First name and phone number are required.');return;}
        var live=!state.status.voice.dryRun;
        var attestation=live
          ? 'Place a BILLABLE LIVE call to '+phone+'?\n\nBy continuing you confirm this person expressly consented to a voice call for this purpose and the evidence is available.'
          : 'Preview a call to '+phone+'?\n\nBy continuing you confirm this person expressly consented to a voice call for this purpose and the evidence is available.';
        if(!window.confirm(attestation)){setResult({blocked:true,code:'OPERATOR_CONSENT_CONFIRMATION_REQUIRED',message:'Consent attestation was not given; nothing was sent.'});return;}
        $('callButton').disabled=true;setResult('Running contact, consent, compliance and calling-window checks…');
        try{
          var call={firstName:firstName,phone:phone,mode:DEMO_MODE,consentConfirmed:true,liveConfirmed:live};
          var response=await api('/demo-api/outbound',{method:'POST',body:JSON.stringify(call)});setResult(response);await loadActivity();
        }catch(error){setResult({ok:false,error:{code:error.code||'REQUEST_FAILED',message:error.message}});}finally{$('callButton').disabled=false;}
      }
      async function configureInbound(){var liveConfirmed=state.status&&!state.status.voice.dryRun?window.confirm('This will rebind the live inbound number to this agent. Continue?'):false;if(state.status&&!state.status.voice.dryRun&&!liveConfirmed)return;try{$('configureInbound').disabled=true;setResult(await api('/demo-api/inbound/configure',{method:'POST',body:JSON.stringify({liveConfirmed:liveConfirmed})}));}catch(error){setResult({ok:false,error:{code:error.code||'REQUEST_FAILED',message:error.message}});}finally{$('configureInbound').disabled=!state.status||!state.status.voice.inboundNumber;}}
      async function loadActivity(){
        if(!state.status)return;try{var data=await api('/demo-api/interactions?limit=12');var box=$('activityList');box.replaceChildren();if(!data.interactions.length){var empty=document.createElement('div');empty.className='empty';empty.textContent='No live dispatch or webhook activity yet. Dry-run output remains in Latest result.';box.appendChild(empty);return;}data.interactions.forEach(function(item){var card=document.createElement('div');card.className='event';var top=document.createElement('div');top.className='event-top';var title=document.createElement('strong');title.textContent=(item.direction||'call').toUpperCase()+' · '+(item.mode||'general');var time=document.createElement('span');time.textContent=new Date(item.createdAt).toLocaleString();top.append(title,time);var p=document.createElement('p');var disposition=item.disposition||'dispatched';var pill=document.createElement('span');pill.className='pill '+(disposition==='COMPLETED_ACTION'?'ok':disposition==='DO_NOT_CONTACT'||disposition==='NOT_INTERESTED'?'stop':disposition==='FOLLOW_UP_REQUIRED'||disposition==='NO_CONTACT_MADE'?'warn':'');pill.textContent=disposition;p.append(pill,document.createTextNode(item.summary||''));card.append(top,p);box.appendChild(card);});}catch(error){setResult({ok:false,error:{code:error.code||'ACTIVITY_FAILED',message:error.message}});}
      }

      $('connectButton').addEventListener('click',connect);$('adminKey').addEventListener('keydown',function(e){if(e.key==='Enter')connect();});$('outboundForm').addEventListener('submit',submitOutbound);$('configureInbound').addEventListener('click',configureInbound);$('copyNumber').addEventListener('click',function(){navigator.clipboard.writeText($('inboundNumber').value);});$('refreshActivity').addEventListener('click',loadActivity);
      if(adminKey())connect();
    })();
  </script>
</body>
</html>`;

export const DEMO_PANEL_USES_REACT_BUILD = fs.existsSync(BUILT_PANEL);
export const DEMO_PANEL_HTML = DEMO_PANEL_USES_REACT_BUILD ? fs.readFileSync(BUILT_PANEL, 'utf8') : LEGACY_DEMO_PANEL_HTML;
