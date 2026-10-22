import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Activity, 
  Cpu, 
  ArrowRight,
  Server,
  Lock
} from 'lucide-react';
import { CyberCubeLogo } from '../components/SplashScreen';
import SetupWizard from '../components/SetupWizard';

const OnboardingPage = () => {
  const [showWizard, setShowWizard] = useState(false);
  const [userName, setUserName] = useState('Operator');
  const navigate = useNavigate();

  useEffect(() => {
    // Retrieve the user's name from the Google login session
    const storedName = sessionStorage.getItem('soc_user_name');
    if (storedName) {
      // Get first name only for a cleaner UI
      setUserName(storedName.split(' ')[0]);
    }
  }, []);

  const handleWizardComplete = () => {
    // Once the agent is connected, redirect to the main dashboard
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none"></div>

      {/* Main Content Container */}
      <div className="relative z-10 max-w-2xl w-full px-6 flex flex-col items-center text-center animate-fade-in-up">
        
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-emerald-900/20 mb-8">
          <CyberCubeLogo className="h-10 w-10 text-emerald-400" />
        </div>

        <h1 className="text-4xl font-bold text-slate-100 tracking-tight mb-4">
          Welcome to the CyberCube, {userName}.
        </h1>
        
        <p className="text-lg text-slate-400 mb-12 max-w-xl">
          Your isolated tenant workspace has been securely provisioned. To begin monitoring and protecting your infrastructure, we need to deploy your first telemetry sensor.
        </p>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center">
            <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 mb-4">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-2">Real-Time Telemetry</h3>
            <p className="text-xs text-slate-400 text-center">Streams bidirectional packet data directly to your cloud dashboard.</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center">
            <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400 mb-4">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-2">AI Classification</h3>
            <p className="text-xs text-slate-400 text-center">Evaluates network flows using the Random Forest CIC-IDS2017 model.</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center">
            <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-rose-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-2">Active Containment</h3>
            <p className="text-xs text-slate-400 text-center">Autonomously blocks critical threats via host OS firewall rules.</p>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => setShowWizard(true)}
          className="group flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/30 transition-all hover:scale-105"
        >
          <Server className="h-5 w-5" />
          <span>Initialize Workspace</span>
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="mt-8 flex items-center gap-2 text-xs text-slate-500 font-mono">
          <Lock className="h-3 w-3" />
          <span>End-to-End Encrypted Tunnel</span>
        </div>

      </div>

      {/* Render the Wizard Overlay when triggered */}
      {showWizard && <SetupWizard onComplete={handleWizardComplete} />}
      
    </div>
  );
};

export default OnboardingPage;