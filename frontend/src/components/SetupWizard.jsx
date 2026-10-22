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
  Copy,
  ExternalLink
} from 'lucide-react';
import { CyberCubeLogo } from './SplashScreen';
import { markSetupComplete } from '../utils/setupState';

const BACKEND_URL = 'https://ai-cyber-threat-backend-k0pz.onrender.com';

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

const SetupWizard = ({ onComplete }) => {
  // Values created at login time
  const tenantKey = sessionStorage.getItem('soc_tenant_key') || 'soc_live_default_key';
  const sessionToken = sessionStorage.getItem('soc_session_token') || '';
  const provisionedKey = sessionStorage.getItem('soc_openrouter_key') || '';

  // Step 1: dashboard link
  const [linkStatus, setLinkStatus] = useState('idle'); // idle | checking | ok | failed
  const [linkError, setLinkError] = useState(null);
  const [streamStatus, setStreamStatus] = useState('unknown'); // unknown | live | unavailable

  // Step 2: OpenRouter connection
  const [orStatus, setOrStatus] = useState('idle'); // idle | checking | ok | failed
  const [orError, setOrError] = useState(null);
  const [orInfo, setOrInfo] = useState(null);
  const [useManualKey, setUseManualKey] = useState(!provisionedKey);
  const [manualKey, setManualKey] = useState('');

  const [copiedField, setCopiedField] = useState(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const finishTimer = useRef(null);
  const copyTimer = useRef(null);

  useEffect(() => () => {
    clearTimeout(finishTimer.current);
    clearTimeout(copyTimer.current);
  }, []);

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
    setStreamStatus('unknown');

    try {
      // Free hosting can take up to a minute to wake the backend, so the timeout is generous.
      await axios.get(`${BACKEND_URL}/health`, {
        headers: { 'X-API-Key': tenantKey },
        timeout: 60000
      });
    } catch (err) {
      setLinkStatus('failed');
      setLinkError(
        err.code === 'ECONNABORTED'
          ? 'The backend took too long to respond. It may be waking up — wait a few seconds and try again.'
          : 'Could not reach the CyberCube backend. Check your connection and try again.'
      );
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
      return;
    }

    setOrStatus('checking');
    setOrError(null);
    setOrInfo(null);

    try {
      // Verification runs on the backend so the browser never depends on OpenRouter's CORS rules.
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
      }
    } catch (err) {
      setOrStatus('failed');
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
      markSetupComplete(); // persists to localStorage so a refresh can never bypass setup
      if (typeof onComplete === 'function') onComplete();
    }, 1500);
  };

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
              <p className="text-xs text-slate-400 font-mono mt-1">Link the dashboard and verify your OpenRouter connection</p>
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
          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
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

                {linkStatus === 'failed' && (
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
          <section className={`rounded-xl border border-slate-800 bg-slate-950/40 p-5 transition-opacity ${linkOk ? 'opacity-100' : 'opacity-60'}`}>
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
                    {!provisionedKey && (
                      <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <span>We couldn't provision a key automatically at login. Paste your own OpenRouter key below to continue.</span>
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

                {orStatus === 'failed' && (
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