import React, { useEffect, useState } from 'react';
import { Music, Mic2, Disc, Cpu, Activity, Zap } from 'lucide-react';
import { UserProfile } from '../types';
import { Logo } from './Logo';

interface LandingPageProps {
  onLogin: (user: UserProfile) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize Google Auth
    const initializeGoogleOneTap = () => {
      if (!window.google) return;

      window.google.accounts.id.initialize({
        client_id: "408818190066-tsvbh2p0nk2eu6v3j4d3ufc46kaikt2j.apps.googleusercontent.com",
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(
        document.getElementById("googleButtonDiv"),
        { theme: "filled_black", size: "large", shape: "pill", width: "100%" }
      );
    };

    // Check if script is loaded, otherwise wait
    if (window.google) {
      initializeGoogleOneTap();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          initializeGoogleOneTap();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const handleCredentialResponse = (response: any) => {
    setLoading(true);
    try {
      // Decode JWT
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const payload = JSON.parse(jsonPayload);
      
      const user: UserProfile = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        sub: payload.sub
      };

      // Slight delay for UX effect
      setTimeout(() => {
        onLogin(user);
      }, 800);
    } catch (e) {
      console.error("Login Failed", e);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-wes-950 font-sans text-white overflow-hidden relative">
      
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-wes-purple/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="container mx-auto px-6 h-screen flex flex-col md:flex-row items-center justify-center relative z-10">
        
        {/* Left: Hero Content */}
        <div className="flex-1 space-y-8 pr-0 md:pr-12 text-center md:text-left mb-12 md:mb-0">
          <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-sm">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-xs font-medium text-gray-300 tracking-wide uppercase">v2.0 Beta Live</span>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-center md:justify-start space-x-4 mb-2">
                 <Logo className="w-12 h-12 md:w-16 md:h-16" />
                 <h1 className="text-5xl md:text-7xl font-bold tracking-tighter">OneSound</h1>
             </div>
             <p className="text-xl md:text-2xl text-gray-400 font-light leading-relaxed max-w-2xl">
               The AI-Powered Audio Workstation. <br/>
               <span className="text-white font-medium">Create, Remaster, and Visualize</span> your music in one place.
             </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto md:mx-0">
             <div className="p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition group">
                <Mic2 className="w-6 h-6 text-wes-purple mb-2 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold">AI Vocal Synthesis</h3>
                <p className="text-sm text-gray-500">Turn lyrics into studio-grade vocals.</p>
             </div>
             <div className="p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition group">
                <Activity className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold">Neural Remastering</h3>
                <p className="text-sm text-gray-500">Instant professional mastering for any track.</p>
             </div>
          </div>
        </div>

        {/* Right: Login Card */}
        <div className="w-full max-w-md">
            <div className="bg-wes-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-wes-purple/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition duration-500"></div>
                
                <div className="relative z-10 text-center space-y-8">
                    <div>
                        <h2 className="text-2xl font-bold mb-2 text-white">Welcome Back</h2>
                        <p className="text-gray-400 text-sm">Sign in to access your studio</p>
                    </div>

                    <div className="min-h-[60px] flex items-center justify-center">
                         {!loading ? (
                             <div id="googleButtonDiv" className="w-full"></div>
                         ) : (
                             <div className="flex items-center space-x-3 text-wes-purple">
                                 <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                 <span className="font-medium">Authenticating...</span>
                             </div>
                         )}
                    </div>

                    <div className="pt-6 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                        <span>&copy; 2025 OneSound AI</span>
                        <div className="flex space-x-3">
                            <span className="cursor-pointer hover:text-white transition">Privacy</span>
                            <span className="cursor-pointer hover:text-white transition">Terms</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};