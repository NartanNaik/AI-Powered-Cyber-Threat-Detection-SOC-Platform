import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { 
  ShieldCheck, 
  AlertCircle, 
  Terminal, 
  Lock, 
  KeyRound
} from 'lucide-react';
import { CyberCubeLogo } from './SplashScreen';
import { isSetupComplete } from '../utils/setupState';

const BACKEND_URL = 'https://ai-cyber-threat-backend-k0pz.onrender.com';

const clearSessionKeys = () => {
  [
    'soc_session_token',
    'soc_tenant_key',
    'soc_user_email',
    'soc_user_name',
    'soc_openrouter_key'
  ].forEach((k) => sessionStorage.removeItem(k));
};

const LoginModal = ({ isOpen, onLoginSuccess }) => {
  const [errorMsg, setErrorMsg] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusText, setStatusText] = useState('Authenticating Security Credentials...');

  if (!isOpen) return null;

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsVerifying(true);
    setErrorMsg(null);
    setStatusText('Authenticating Security Credentials...');

    // Never let a previous user's keys leak into this session.
    clearSessionKeys();

    try {
      // 1. Exchange the Google ID token with the backend to authenticate / provision the tenant.
      //    The free backend host can take a while to wake up, so the timeout is generous.
      const res = await axios.post(
        `${BACKEND_URL}/auth/google`,
        { token: credentialResponse.credential },
        { timeout: 60000 }
      );

      if (!res.data || !res.data.api_key || !res.data.access_token) {
        throw new Error('Tenant provisioning failed: invalid server response.');
      }

      sessionStorage.setItem('soc_session_token', res.data.access_token);
      sessionStorage.setItem('soc_tenant_key', res.data.api_key);
      sessionStorage.setItem('soc_user_email', res.data.email);
      sessionStorage.setItem('soc_user_name', res.data.name || 'Security Operator');

      const isNewUser = res.data.is_first_login || false;

      // 2. Ask the backend to generate this user's OpenRouter key.
      //    The management key never leaves the server; we only receive the user's own $0-capped key.
      //    Users who already finished setup keep their existing key, so we skip re-provisioning.
      if (!isSetupComplete()) {
        setStatusText('Provisioning your AI workspace...');
        try {
          const keyRes = await axios.post(
            `${BACKEND_URL}/openrouter/provision`,
            {},
            {
              headers: { Authorization: `Bearer ${res.data.access_token}` },
              timeout: 30000
            }
          );
          if (keyRes.data && keyRes.data.api_key) {
            sessionStorage.setItem('soc_openrouter_key', keyRes.data.api_key);
          }
        } catch (keyErr) {
          // Not fatal: the setup wizard lets the user paste their own OpenRouter key instead.
          console.warn('OpenRouter key provisioning failed:', keyErr?.response?.data?.detail || keyErr.message);
        }
      }

      onLoginSuccess({
        apiKey: res.data.api_key,
        email: res.data.email,
        name: res.data.name,
        isNewUser
      });
    } catch (err) {
      console.error('Authentication Error:', err);
      clearSessionKeys();

      let message = 'Sign-in failed. Please try again.';
      if (err.code === 'ECONNABORTED') {
        message = 'The backend took too long to respond. It may be waking up. Wait a few seconds and try again.';
      } else if (err.response?.data?.detail) {
        message = err.response.data.detail;
      } else if (!err.response) {
        message = 'Could not reach the CyberCube backend. Check your connection and try again.';
      }
      setErrorMsg(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoogleFailure = () => {
    setErrorMsg('Google authentication request failed. Please check your network or pop-up blocker.');
    setIsVerifying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl shadow-emerald-950/30">
        
        {/* Visual Accent Glow */}
        <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>

        {/* Modal Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/80 text-emerald-400 shadow-inner">
            <CyberCubeLogo className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-100 uppercase font-sans">
            CyberCube
          </h2>
          <p className="mt-1 text-xs text-slate-400 tracking-wide font-mono">
            Autonomous Multi-Tenant SOC & Telemetry Gateway
          </p>
        </div>

        {/* Informational SOC Badges */}
        <div className="mt-6 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-300">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Multi-Tenant Vault</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
            <Lock className="h-4 w-4 text-blue-400 shrink-0" />
            <span>Zero-Trust Auth</span>
          </div>
        </div>

        {/* Status Error Container */}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google Authentication Section */}
        <div className="mt-6 flex flex-col items-center justify-center">
          {isVerifying ? (
            <div className="flex items-center gap-2.5 py-3 text-xs font-semibold text-emerald-400 font-mono">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></span>
              <span>{statusText}</span>
            </div>
          ) : (
            <div className="w-full flex justify-center py-1">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleFailure}
                theme="filled_black"
                shape="rectangular"
                size="large"
                width="340"
                text="signin_with"
              />
            </div>
          )}
        </div>

        {/* Terminal Protocol Footnote */}
        <div className="mt-6 border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Terminal className="h-3 w-3 text-slate-600" />
              <span>TLS 1.3 / E2EE STREAM</span>
            </span>
            <span className="flex items-center gap-1">
              <KeyRound className="h-3 w-3 text-slate-600" />
              <span>TOKEN ISOLATED</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginModal;