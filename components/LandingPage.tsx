import React, { useEffect, useState } from 'react';
import { Music, Mic2, Disc } from 'lucide-react';
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
    <div className="flex min-h-screen bg-black overflow-hidden font-sans">
      
      {/* LEFT PANEL - IMMERSIVE VISUALS */}
      <div className="hidden lg:flex w-[60%] relative flex-col justify-between p-16 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-wes-900 z-0">
           <div className="absolute top-0 left-[-10%] w-[500px] h-[500px] bg-wes-purple/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
           <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-2000"></div>
           <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-indigo-900/20 rounded-full mix-blend-screen filter blur-[120px] animate-blob animation-delay-4000"></div>
           {/* Grid Pattern Overlay */}
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="w-16 h-16 shadow-2xl shadow-purple-900/50 mb-8 rounded-2xl overflow-hidden">
             <Logo className="w-full h-full" />
          </div>
          <h1 className="text-7xl font-bold text-white tracking-tight leading-tight mb-6">
            Redefine<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-wes-purple to-blue-400">Your Sound.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-lg leading-relaxed">
            The world's most advanced AI music studio. Remaster classics, generate originals, and visualize your audio in real-time.
          </p>
        </div>

        {/* Feature Pills */}
        <div className="relative z-10 flex space-x-4">
            <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <Music className="w-4 h-4 text-wes-purple" />
                <span className="text-sm text-gray-300">AI Composition</span>
            </div>
            <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <Mic2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">Vocal Synthesis</span>
            </div>
            <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <Disc className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">Remastering</span>
            </div>
        </div>
      </div>

      {/* RIGHT PANEL - LOGIN */}
      <div className="w-full lg:w-[40%] bg-wes-900 border-l border-wes-800 flex flex-col justify-center items-center p-8 relative">
        <div className="w-full max-w-md space-y-8 relative z-10">
          
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-white">Welcome Back</h2>
            <p className="text-gray-400">Sign in to access your studio.</p>
          </div>

          {/* Login Card */}
          <div className="glass-panel p-8 rounded-2xl shadow-2xl border border-wes-700/50 backdrop-blur-xl">
            <div className="space-y-6">
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="w-8 h-8 border-4 border-wes-purple border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-gray-400">Authenticating...</p>
                    </div>
                ) : (
                    <>
                        <div id="googleButtonDiv" className="h-12 w-full flex justify-center"></div>
                        
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-wes-700" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#1e1e1e] px-2 text-gray-500 rounded px-2">Secure Access</span>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-xs text-gray-500">
                                By continuing, you agree to OneSound's <a href="#" className="text-wes-purple hover:underline">Terms of Service</a> and <a href="#" className="text-wes-purple hover:underline">Privacy Policy</a>.
                            </p>
                        </div>
                    </>
                )}
            </div>
          </div>
        </div>

        {/* Mobile-only background hint */}
        <div className="absolute inset-0 bg-gradient-to-t from-black to-wes-900 lg:hidden -z-10"></div>
      </div>
    </div>
  );
};