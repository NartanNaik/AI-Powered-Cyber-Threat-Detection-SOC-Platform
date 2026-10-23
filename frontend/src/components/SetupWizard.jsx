import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Link2,
  KeyRound,
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ChevronRight,
  ShieldCheck,
  ShieldOff,
  Copy,
  ExternalLink,
  Download,
  Terminal
} from 'lucide-react';
import { CyberCubeLogo } from './SplashScreen';
import { markSetupComplete } from '../utils/setupState';

const BACKEND_URL = 'https://ai-cyber-threat-backend-k0pz.onrender.com';

// TODO: replace "yourusername" with your GitHub account and make sure each release
// asset below is uploaded under exactly this file name.
const AGENT_RELEASE_BASE = 'https://github.com/yourusername/cybercube-agent/releases/latest/download';

const SENSOR_PLATFORMS = {
  windows: {
    label: 'Windows',
    file: 'agent.exe',
    runIntro: 'Open PowerShell in the folder where you saved the file, then run:',
    command: (key) => `.\\agent.exe --key ${key}`,
    hint: 'If Windows SmartScreen appears, choose More info, then Run anyway. Run PowerShell as Administrator if the sensor asks for elevated access.'
  },
  macos: {
    label: 'macOS',
    file: 'agent-macos',
    runIntro: 'Open Terminal in the folder where you saved the file, then run:',
    command: (key) =>
      `xattr -d com.apple.quarantine ./agent-macos 2>/dev/null; chmod +x ./agent-macos && sudo ./agent-macos --key ${key}`,
    hint: 'macOS may block downloaded programs the first time. The first part of the command clears that block. You will be asked for your Mac password.'
  },
  linux: {
    label: 'Linux',
    file: 'agent-linux',
    runIntro: 'Open a terminal in the folder where you saved the file, then run:',
    command: (key) => `chmod +x ./agent-linux && sudo ./agent-linux --key ${key}`,
    hint: 'The command makes the file executable and starts it with sudo so it can read network traffic.'
  }
};

const detectPlatform = () => {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  return 'linux';
};

const maskKey = (key) => {
  if (!key) return '';
  return key.length <= 14 ? '••••••••' : `${key.slice(0, 10)}••••••••${key.slice(-4)}`;
};

// Opens the live telemetry socket just long enough to confirm it connects.
const testWebSocket = (url, timeoutMs = 10000) =>
  new Promise((resolve) => {
    let settled = false;
    let socket;
    let timer;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { if (socket) socket.close(); } catch (e) { /* ignore */ }
      resolve(ok);
    };
    timer = setTimeout(() => finish(false), timeoutMs);
    try {
      socket = new WebSocket(url);
      socket.onopen = () => finish(true);
      socket.onerror = () => finish(false);
      socket.onclose = () => finish(false);
    } catch (e) {
      finish(false);
    }
  });

const StepNumber = ({ n, done }) => (
  <div
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
      done
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
        : 'border-slate-700 bg-slate-800 text-slate-300'
    }`}
  >
    {done ? <CheckCircle2 className="h-4 w-4" /> : n}
  </div>
);

const CopyRow = ({ label, value, copied, onCopy }) => (
  <div>
    <span className="text-[11px] font-semibold text-slate-500">{label}</span>
    <div className="mt-1 flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2">
      <code className="min-w-0 truncate text-xs font-mono text-slate-300 select-all">{value}</code>
      <button
        type="button"
        onClick={onCopy}
        className="ml-3 shrink-0 text-slate-500 transition-colors hover:text-emerald-400"
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  </div>
);

// Same look as CopyRow, but wraps long terminal commands instead of truncating them.
const CommandBlock = ({ label, value, copied, onCopy }) => (
  <div>
    <span className="text-[11px] font-semibold text-slate-500">{label}</span>
    <div className="mt-1 flex items-start justify-between gap-3 rounded border border-slate-800 bg-slate-950 px-3 py-2.5">
      <code className="min-w-0 flex-1 break-all text-xs font-mono leading-relaxed text-emerald-300 select-all">{value}</code>
      <button
        type="button"
        onClick={onCopy}
        className="mt-0.5 shrink-0 text-slate-500 transition-colors hover:text-emerald-400"
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  </div>
);

const SetupWizard = ({ onComplete }) => {
  // Values created at login time
  const tenantKey = sessionStorage.getItem('soc_tenant_key') || 'soc_live_default_key';
  const sessionToken = sessionStorage.getItem('soc_session_token') || '';
  const provisionedKey = sessionStorage.getItem('soc_openrouter_key') || '';

  // Step 1: dashboard link
  const [linkStatus, setLinkStatus] = useState('idle'); // idle | checking | ok | failed
  const [linkError, setLinkError] = useState(null);
  const [linkBlocked, setLinkBlocked] = useState(false); // request never got a response (adblocker / shield / offline)
  const [streamStatus, setStreamStatus] = useState('unknown'); // unknown | live | unavailable

  // Step 2: OpenRouter connection
  const [orStatus, setOrStatus] = useState('idle'); // idle | checking | ok | failed
  const [orError, setOrError] = useState(null);
  const [orInfo, setOrInfo] = useState(null);
  const [useManualKey, setUseManualKey] = useState(!provisionedKey);
  const [manualKey, setManualKey] = useState('');

  // Step 3: sensor deployment (optional)
  const [sensorPlatform, setSensorPlatform] = useState(detectPlatform);

  const [copiedField, setCopiedField] = useState(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const finishTimer = useRef(null);
  const copyTimer = useRef(null);
  const autoLinkStarted = useRef(false);
  const autoVerifyStarted = useRef(false);

  useEffect(() => () => {
    clearTimeout(finishTimer.current);
    clearTimeout(copyTimer.current);
  }, []);

  // --- AUTO EXECUTION HOOKS ---
  // Each runs exactly once, so retyping a key or clicking "Use a different key"
  // can never trigger a surprise background verification.
  useEffect(() => {
    if (autoLinkStarted.current) return;
    autoLinkStarted.current = true;
    handleEstablishLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (linkStatus !== 'ok' || autoVerifyStarted.current) return;
    autoVerifyStarted.current = true;
    if (provisionedKey) {
      handleVerifyOpenRouter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkStatus]);

  const copyText = (value, field) => {
    try {
      navigator.clipboard.writeText(value);
    } catch (e) {
      /* clipboard unavailable */
    }
    setCopiedField(field);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedField(null), 2000);
  };

  const handleEstablishLink = async () => {
    setLinkStatus('checking');
    setLinkError(null);
    setLinkBlocked(false);
    setStreamStatus('unknown');

    try {
      await axios.get(`${BACKEND_URL}/health`, {
        headers: { 'X-API-Key': tenantKey },
        timeout: 60000
      });
    } catch (err) {
      setLinkStatus('failed');
      if (err.code === 'ECONNABORTED') {
        setLinkError('The backend took too long to respond. It may be waking up — wait a few seconds and try again.');
      } else if (!err.response) {
        // The request never produced an HTTP response. Browsers report an adblocker or shield
        // block (ERR_BLOCKED_BY_CLIENT) exactly like any other network error.
        setLinkBlocked(true);
      } else {
        setLinkError('The CyberCube backend responded with an error. Wait a moment and try again.');
      }
      return;
    }

    const wsBase = BACKEND_URL.replace(/^http/, 'ws');
    const wsOk = await testWebSocket(`${wsBase}/ws/threats?api_key=${encodeURIComponent(tenantKey)}`);
    setStreamStatus(wsOk ? 'live' : 'unavailable');
    setLinkStatus('ok');
  };

  const activeKey = useManualKey ? manualKey.trim() : provisionedKey;

  const handleVerifyOpenRouter = async () => {
    if (!activeKey) {
      setOrStatus('failed');
      setOrError('Paste an OpenRouter API key to verify.');
      setUseManualKey(true);
      return;
    }

    setOrStatus('checking');
    setOrError(null);
    setOrInfo(null);

    try {
      const res = await axios.post(
        `${BACKEND_URL}/openrouter/verify`,
        { api_key: activeKey },
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
          timeout: 30000
        }
      );

      if (res.data && res.data.valid) {
        if (useManualKey) sessionStorage.setItem('soc_openrouter_key', activeKey);
        setOrInfo(res.data);
        setOrStatus('ok');
      } else {
        setOrStatus('failed');
        setOrError('OpenRouter did not confirm this key. Check it and try again.');
        setUseManualKey(true);
      }
    } catch (err) {
      setOrStatus('failed');
      setUseManualKey(true);
      if (err.response?.status === 401) {
        setOrError('Your session has expired. Sign in again to continue.');
      } else {
        setOrError(
          err.response?.data?.detail ||
            'Could not verify the key right now. Check your connection and try again.'
        );
      }
    }
  };

  const linkOk = linkStatus === 'ok';
  const orOk = orStatus === 'ok';
  const checksPassed = (linkOk ? 1 : 0) + (orOk ? 1 : 0);
  const anyChecking = linkStatus === 'checking' || orStatus === 'checking';
  const canFinish = linkOk && orOk && !isFinishing;

  const handleFinish = () => {
    if (!canFinish) return;
    setIsFinishing(true);
    finishTimer.current = setTimeout(() => {
      markSetupComplete(); 
      if (typeof onComplete === 'function') onComplete();
    }, 1500);
  };

  const platform = SENSOR_PLATFORMS[sensorPlatform];
  const sensorDownloadUrl = `${AGENT_RELEASE_BASE}/${platform.file}`;
  const sensorCommand = platform.command(tenantKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[92vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-950/50 px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-emerald-400">
              <CyberCubeLogo className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">Connect Your Workspace</h2>
              <p className="text-xs text-slate-400 font-mono mt-1">Link the dashboard, verify OpenRouter, and deploy your sensor</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>Setup Phase</span>
          </div>
        </div>

        {/* Success Overlay */}
        {isFinishing && (
          <div className="absolute inset-0 z-10 bg-slate-950/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/30">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-2">Workspace Connected</h3>
            <p className="text-slate-400 text-sm font-mono">Dashboard linked and OpenRouter verified. Opening your SOC console...</p>
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-5">

          {/* Step 1: Dashboard link */}
          <section className={`rounded-xl border ${linkOk ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-slate-800 bg-slate-950/40'} p-5 transition-colors`}>
            <div className="flex items-start gap-4">
              <StepNumber n={1} done={linkOk} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Link your dashboard</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  This browser session is bound to a private workspace. Establish the link to confirm the dashboard can reach the CyberCube backend and open the live telemetry stream.
                </p>

                <div className="mt-4 grid gap-3">
                  <CopyRow
                    label="Workspace ID"
                    value={tenantKey}
                    copied={copiedField === 'tenant'}
                    onCopy={() => copyText(tenantKey, 'tenant')}
                  />
                  <CopyRow
                    label="Backend endpoint"
                    value={BACKEND_URL}
                    copied={copiedField === 'backend'}
                    onCopy={() => copyText(BACKEND_URL, 'backend')}
                  />
                </div>

                {linkStatus === 'failed' && linkBlocked && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300">
                    <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-semibold">
                        Your browser's adblocker or shield is blocking the connection to the SOC backend. Please disable it for this site and try again.
                      </p>
                      <p className="mt-1 text-amber-300/80">
                        Already disabled it? The server may still be waking up, so wait a few seconds before retrying.
                      </p>
                    </div>
                  </div>
                )}

                {linkStatus === 'failed' && !linkBlocked && linkError && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    <span>{linkError}</span>
                  </div>
                )}

                {linkOk && (
                  <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Dashboard linked to the backend.</span>
                    </div>
                    <p className="mt-1 text-emerald-300/80">
                      {streamStatus === 'live'
                        ? 'Live telemetry stream: connected.'
                        : 'Live telemetry stream: unavailable right now. The dashboard still works, but live alerts may be delayed.'}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleEstablishLink}
                  disabled={linkStatus === 'checking' || isFinishing}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {linkStatus === 'checking' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Establishing link...</span>
                    </>
                  ) : (
                    <span>{linkOk ? 'Re-check link' : linkStatus === 'failed' ? 'Try again' : 'Establish link'}</span>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Step 2: OpenRouter connection */}
          <section className={`rounded-xl border ${orOk ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-slate-800 bg-slate-950/40'} p-5 transition-opacity ${linkOk ? 'opacity-100' : 'opacity-60'}`}>
            <div className="flex items-start gap-4">
              <StepNumber n={2} done={orOk} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Verify your OpenRouter connection</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  CyberCube uses OpenRouter for AI threat explanations. Your key is capped at $0.00, so it can only use free models.
                </p>

                {!useManualKey ? (
                  <div className="mt-4">
                    <CopyRow
                      label="Provisioned key"
                      value={maskKey(provisionedKey)}
                      copied={false}
                      onCopy={() => {}}
                    />
                    <button
                      type="button"
                      onClick={() => { setUseManualKey(true); setOrStatus('idle'); setOrError(null); setOrInfo(null); }}
                      className="mt-2 text-[11px] font-semibold text-slate-500 transition-colors hover:text-emerald-400"
                    >
                      Use a different key
                    </button>
                  </div>
                ) : (
                  <div className="mt-4">
                    {(!provisionedKey || orStatus === 'failed') && (
                      <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <span>{orError || "We couldn't provision a key automatically at login. Paste your own OpenRouter key below to continue."}</span>
                      </div>
                    )}
                    <label className="text-[11px] font-semibold text-slate-500" htmlFor="or-key-input">OpenRouter API key</label>
                    <input
                      id="or-key-input"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={manualKey}
                      onChange={(e) => { setManualKey(e.target.value); setOrStatus('idle'); setOrError(null); setOrInfo(null); }}
                      placeholder="sk-or-v1-..."
                      className="mt-1 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/60"
                    />
                    <div className="mt-2 flex items-center gap-4">
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition-colors hover:text-emerald-400"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Get a key from OpenRouter</span>
                      </a>
                      {provisionedKey && (
                        <button
                          type="button"
                          onClick={() => { setUseManualKey(false); setOrStatus('idle'); setOrError(null); setOrInfo(null); }}
                          className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-emerald-400"
                        >
                          Use the provisioned key
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {orStatus === 'failed' && !useManualKey && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    <span>{orError}</span>
                  </div>
                )}

                {orOk && orInfo && (
                  <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>OpenRouter connection verified.</span>
                    </div>
                    <p className="mt-1 text-emerald-300/80">
                      {orInfo.label ? `Key: ${orInfo.label}. ` : ''}
                      {typeof orInfo.limit === 'number' ? `Spend cap: $${orInfo.limit.toFixed(2)}. ` : 'No spend cap reported. '}
                      {typeof orInfo.usage === 'number' ? `Usage so far: $${orInfo.usage.toFixed(2)}.` : ''}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleVerifyOpenRouter}
                  disabled={!linkOk || orStatus === 'checking' || isFinishing}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {orStatus === 'checking' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>{orOk ? 'Re-verify connection' : orStatus === 'failed' ? 'Try again' : 'Verify connection'}</span>
                  )}
                </button>
                {!linkOk && (
                  <p className="mt-2 text-[11px] text-slate-500">Link your dashboard in step 1 first.</p>
                )}
              </div>
            </div>
          </section>

          {/* Step 3: Deploy security sensor (optional, does not block Finish setup) */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex items-start gap-4">
              <StepNumber n={3} done={false} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Deploy your security sensor</h3>
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    Optional, you can do this later
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  The sensor is a ready-to-run program. Download it, paste one command, and it starts sending live traffic to your private workspace. Nothing to install and no configuration files.
                </p>

                {/* Platform tabs */}
                <div role="tablist" aria-label="Operating system" className="mt-4 inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1">
                  {Object.entries(SENSOR_PLATFORMS).map(([id, p]) => {
                    const selected = sensorPlatform === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setSensorPlatform(id)}
                        className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                          selected
                            ? 'bg-slate-800 text-emerald-400 shadow shadow-slate-950/50'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-col gap-4" role="tabpanel">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">A. Download the sensor</span>
                    <div className="mt-1">
                      <a
                        href={sensorDownloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-slate-700"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download {platform.file}</span>
                      </a>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">B. Run it with your workspace key</p>
                    <p className="mt-1 text-xs text-slate-400">{platform.runIntro}</p>
                    <div className="mt-2">
                      <CommandBlock
                        label={`${platform.label} command`}
                        value={sensorCommand}
                        copied={copiedField === 'sensor-command'}
                        onCopy={() => copyText(sensorCommand, 'sensor-command')}
                      />
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{platform.hint}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 bg-slate-950/50 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${anyChecking ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${anyChecking ? 'bg-amber-500' : checksPassed === 2 ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
            </span>
            {anyChecking ? 'CHECKING CONNECTION...' : `${checksPassed}/2 CHECKS PASSED`}
          </div>
          
          <button
            onClick={handleFinish}
            disabled={!canFinish}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all"
          >
            <span>Finish setup</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default SetupWizard;