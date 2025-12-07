import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Player } from './components/Player';
import { CreateTrack } from './components/CreateTrack';
import { RemasterTrack } from './components/RemasterTrack';
import { Settings } from './components/Settings';
import { LandingPage } from './components/LandingPage';
import { Logo } from './components/Logo';
import { AppView, Song, UserProfile } from './types';
import { Play, MoreHorizontal, Trash2 } from 'lucide-react';
import { useLibrary } from './hooks/useLibrary';
import { ToastProvider, useToast } from './context/ToastContext';

// Inner App Component to use Toast Context
const MainApp = ({ user, logout }: { user: UserProfile, logout: () => void }) => {
    const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
    const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
    const { addToast } = useToast();

    // Use custom hook for library management
    const { history, addTrack, updateTrack, deleteTrack } = useLibrary(user);

    const handleTrackCreated = (track: Song) => {
        addTrack(track);
        setCurrentTrack(track);
        setCurrentView(AppView.LIBRARY); 
    };

    const handleUpdateTrack = (trackId: string, updates: Partial<Song>) => {
        updateTrack(trackId, updates);
        // Also update current track if it's the one being modified
        if (currentTrack?.id === trackId) {
            setCurrentTrack(prev => prev ? { ...prev, ...updates } : null);
        }
    };

    const playTrack = (track: Song) => {
        setCurrentTrack(track);
    };

    const handleDeleteTrack = async (e: React.MouseEvent, trackId: string) => {
        e.stopPropagation(); // Stop row click (play) event
        
        if (window.confirm("Are you sure you want to permanently delete this track? This action cannot be undone.")) {
            const success = await deleteTrack(trackId);
            if (success) {
                addToast("Track deleted successfully.", "success");
                if (currentTrack?.id === trackId) {
                    setCurrentTrack(null);
                }
            } else {
                addToast("Failed to delete track.", "error");
            }
        }
    };

    const renderContent = () => {
        switch (currentView) {
        case AppView.CREATE:
            return <CreateTrack onTrackCreated={handleTrackCreated} />;
        case AppView.REMASTER:
            return <RemasterTrack />;
        case AppView.SETTINGS:
            return <Settings user={user} />;
        case AppView.DASHBOARD:
        case AppView.LIBRARY:
        default:
            return (
            <div className="p-8">
                <header className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">
                    {currentView === AppView.DASHBOARD ? `Good Evening, ${user.name.split(' ')[0]}` : "Library"}
                </h2>
                <p className="text-gray-400">
                    {currentView === AppView.DASHBOARD ? "Here's your latest productions." : "All your generated tracks."}
                </p>
                </header>

                {currentView === AppView.DASHBOARD && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        <div className="bg-gradient-to-br from-indigo-900 to-wes-900 border border-wes-700 p-6 rounded-2xl relative overflow-hidden group cursor-pointer" onClick={() => setCurrentView(AppView.CREATE)}>
                            <div className="absolute right-0 top-0 w-32 h-32 bg-wes-purple/20 blur-3xl rounded-full"></div>
                            <h3 className="text-xl font-bold text-white mb-2">Create New</h3>
                            <p className="text-gray-400 text-sm mb-4">Start a new project from scratch using AI generation.</p>
                            <span className="text-wes-purple font-medium text-sm group-hover:underline">Open Studio &rarr;</span>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-900 to-wes-900 border border-wes-700 p-6 rounded-2xl relative overflow-hidden group cursor-pointer" onClick={() => setCurrentView(AppView.REMASTER)}>
                            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                            <h3 className="text-xl font-bold text-white mb-2">Remaster</h3>
                            <p className="text-gray-400 text-sm mb-4">Enhance existing audio files with clarity.</p>
                            <span className="text-emerald-400 font-medium text-sm group-hover:underline">Upload File &rarr;</span>
                        </div>
                    </div>
                )}

                <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-wes-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5">Title</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Duration</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>
                
                <div className="divide-y divide-wes-800">
                    {history.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No tracks found. Start creating!
                        </div>
                    )}
                    {history.map((song, index) => (
                        <div 
                            key={song.id} 
                            className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-wes-800/50 transition group cursor-pointer ${currentTrack?.id === song.id ? 'bg-wes-800/80' : ''}`}
                            onClick={() => playTrack(song)}
                        >
                            <div className="col-span-1 text-center text-gray-500 group-hover:text-white">
                            {currentTrack?.id === song.id ? <div className="w-3 h-3 bg-wes-purple rounded-full mx-auto animate-pulse"></div> : index + 1}
                            </div>
                            <div className="col-span-5 flex items-center space-x-4">
                            <img src={song.coverArtUrl || "https://picsum.photos/50"} className="w-10 h-10 rounded shadow-md object-cover" alt="Art" />
                            <div>
                                <p className={`font-medium ${currentTrack?.id === song.id ? 'text-wes-purple' : 'text-white'}`}>{song.title}</p>
                                <p className="text-xs text-gray-500">{song.artist} • {song.genre}</p>
                            </div>
                            </div>
                            <div className="col-span-2 text-sm text-gray-400">
                            {song.createdAt.toLocaleDateString()}
                            </div>
                            <div className="col-span-2 text-sm text-gray-400 font-mono">
                            {Math.floor(song.duration / 60)}:{Math.floor(song.duration % 60).toString().padStart(2, '0')}
                            </div>
                            <div className="col-span-2 flex justify-end space-x-2">
                                <button className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition">
                                    <Play size={16} fill="currentColor" />
                                </button>
                                <button 
                                    className="p-2 hover:bg-red-900/30 rounded-full text-gray-500 hover:text-red-400 transition"
                                    onClick={(e) => handleDeleteTrack(e, song.id)}
                                    title="Delete Track"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                </div>
            </div>
            );
        }
    };

    return (
        <div className="flex min-h-screen bg-black font-sans text-gray-100">
            <Sidebar currentView={currentView} onChangeView={setCurrentView} onLogout={logout} />
            
            <main className="flex-1 ml-64 pb-24 relative z-10">
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-wes-900 to-black z-0 pointer-events-none"></div>
            <div className="relative z-10 h-full">
                {renderContent()}
            </div>
            </main>

            <Player currentTrack={currentTrack} onUpdateTrack={handleUpdateTrack} />
        </div>
    );
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // Check for persisted session on mount
  useEffect(() => {
    const restoreSession = () => {
      try {
        const storedUser = localStorage.getItem('onesound_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Failed to restore session", e);
        localStorage.removeItem('onesound_user');
      } finally {
        setIsSessionLoading(false);
      }
    };

    restoreSession();
  }, []);

  const handleLogin = (loggedInUser: UserProfile) => {
    localStorage.setItem('onesound_user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('onesound_user');
    setUser(null);
  };

  // Show loading screen while checking session
  if (isSessionLoading) {
    return (
      <div className="flex min-h-screen bg-black items-center justify-center">
        <div className="flex flex-col items-center animate-pulse">
           <div className="w-16 h-16 shadow-2xl shadow-purple-900/50 mb-4 rounded-2xl overflow-hidden">
             <Logo className="w-full h-full" />
          </div>
          <p className="text-gray-500 text-xs font-mono tracking-widest">INITIALIZING STUDIO...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show Landing Page
  if (!user) {
    return (
      <ToastProvider>
        <LandingPage onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
        <MainApp user={user} logout={handleLogout} />
    </ToastProvider>
  );
}