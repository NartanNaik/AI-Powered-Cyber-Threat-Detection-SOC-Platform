import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Terminal, 
  Download, 
  PlayCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ChevronRight,
  ShieldCheck,
  Copy,
  Server
} from 'lucide-react';
import { CyberCubeLogo } from './SplashScreen';

const SetupWizard = ({ onComplete }) => {
  const [activeOS, setActiveOS] = useState('windows');
  const [connectionStatus, setConnectionStatus] = useState('idle'); // idle, listening, failed, success
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [copied, setCopied] = useState(false);

  // Retrieve the generated API key from session storage
  const tenantKey = sessionStorage.getItem('soc_tenant_key') || 'soc_live_default_key';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tenantKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleListenForConnection = () => {
    setConnectionStatus('listening');
    
    // Simulate connection checking delay
    setTimeout(() => {
      // On the first attempt, we simulate a failure to show the warning modal you requested.
      // On the second attempt, we simulate a successful connection.
      if (connectionAttempts === 0) {
        setConnectionStatus('failed');
        setConnectionAttempts(1);
      } else {
        setConnectionStatus('success');
        setTimeout(() => {
          onComplete(); // Advance to main dashboard
        }, 1500);
      }
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-950/50 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-emerald-400">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">Deploy Security Sensor</h2>
              <p className="text-xs text-slate-400 font-mono mt-1">Bind your machine to the SOC dashboard</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>Setup Phase</span>
          </div>
        </div>

        {/* Status Warning Modal Overlay (Triggered on 0 packets) */}
        {connectionStatus === 'failed' && (
          <div className="absolute inset-0 z-10 bg-slate-950/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
            <div className="h-16 w-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4 border border-rose-500/30">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-2">0 Telemetry Events Detected</h3>
            <p className="text-slate-400 text-sm max-w-md mb-8">
              We are not receiving any network packets from your machine. Are you absolutely sure you ran the sensor with <strong className="text-slate-200">Administrator / Root</strong> privileges? Raw socket sniffing requires elevated permissions.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConnectionStatus('idle')}
                className="px-6 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-colors text-sm"
              >
                Review Instructions
              </button>
              <button 
                onClick={handleListenForConnection}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-emerald-900/20"
              >
                <PlayCircle className="h-4 w-4" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}

        {/* Success Overlay */}
        {connectionStatus === 'success' && (
          <div className="absolute inset-0 z-10 bg-slate-950/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/30">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-2">Sensor Synchronized</h3>
            <p className="text-slate-400 text-sm font-mono">Telemetry stream established. Redirecting to SOC console...</p>
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 flex flex-col sm:flex-row min-h-[400px]">
          
          {/* OS Sidebar Tabs */}
          <div className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-slate-800 bg-slate-950/30 p-4 flex flex-row sm:flex-col gap-2">
            <button
              onClick={() => setActiveOS('windows')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeOS === 'windows' 
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-md' 
                  : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300 border border-transparent'
              }`}
            >
              <Monitor className="h-4 w-4 shrink-0" />
              <span>Windows</span>
            </button>
            
            <button
              onClick={() => setActiveOS('mac')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeOS === 'mac' 
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-md' 
                  : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300 border border-transparent'
              }`}
            >
              <Terminal className="h-4 w-4 shrink-0" />
              <span>macOS</span>
            </button>

            <button
              onClick={() => setActiveOS('linux')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeOS === 'linux' 
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-md' 
                  : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300 border border-transparent'
              }`}
            >
              <Terminal className="h-4 w-4 shrink-0" />
              <span>Linux</span>
            </button>
          </div>

          {/* Instructions Content */}
          <div className="flex-1 p-8 flex flex-col">
            
            {/* Global API Key Requirement */}
            <div className="mb-6 p-4 rounded-lg border border-slate-700 bg-slate-900 flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Configure Environment</span>
              <p className="text-sm text-slate-300">Create a <code className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-emerald-400">.env</code> file in your sensor directory and add your unique tenant key:</p>
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded px-3 py-2 mt-1">
                <code className="text-xs text-slate-300 font-mono select-all">API_KEY={tenantKey}</code>
                <button onClick={copyToClipboard} className="text-slate-500 hover:text-emerald-400 transition-colors">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">2. Launch Agent</span>

            {/* Windows Instructions */}
            {activeOS === 'windows' && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm">A</div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Download Executable</h4>
                    <p className="text-xs text-slate-400 mt-1">Download the zero-dependency Windows agent.</p>
                    <button className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 hover:bg-slate-700 transition-colors text-xs font-semibold">
                      <Download className="h-3 w-3" /> AI_SOC_Agent.exe
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm">B</div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Execute with Privileges</h4>
                    <p className="text-xs text-slate-400 mt-1">Right-click the downloaded <code className="text-emerald-400 bg-slate-900 px-1 rounded">.exe</code> file and select <strong>"Run as Administrator"</strong>.</p>
                  </div>
                </div>
              </div>
            )}

            {/* macOS / Linux Instructions */}
            {(activeOS === 'mac' || activeOS === 'linux') && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm">A</div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Install Dependencies</h4>
                    <p className="text-xs text-slate-400 mt-1 mb-2">Ensure Python 3 is installed, then install Scapy.</p>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-300">
                      pip3 install scapy python-dotenv requests
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm">B</div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Run Python Script</h4>
                    <p className="text-xs text-slate-400 mt-1 mb-2">Execute the cross-platform agent with root permissions.</p>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-emerald-400">
                      sudo python3 mac_agent.py
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 bg-slate-950/50 p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${connectionStatus === 'listening' ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${connectionStatus === 'listening' ? 'bg-amber-500' : 'bg-slate-500'}`}></span>
            </span>
            {connectionStatus === 'listening' ? 'AWAITING HANDSHAKE...' : 'STATUS: OFFLINE'}
          </div>
          
          <button
            onClick={handleListenForConnection}
            disabled={connectionStatus === 'listening'}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all"
          >
            {connectionStatus === 'listening' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Scanning Packets...</span>
              </>
            ) : (
              <>
                <span>Done, Check Connection</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SetupWizard;