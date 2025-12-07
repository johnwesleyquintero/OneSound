
import React, { useState } from 'react';
import { Upload, Sliders, CheckCircle2 } from 'lucide-react';
import { REMASTER_STYLES } from '../constants';
import { useToast } from '../context/ToastContext';

export const RemasterTrack: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const { addToast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Basic validation check
      if (selectedFile.size > 50 * 1024 * 1024) {
        addToast("File size too large. Max 50MB.", 'error');
        return;
      }
      setFile(selectedFile);
      setIsDone(false);
      setProgress(0);
      addToast(`File loaded: ${selectedFile.name}`, 'info');
    }
  };

  const handleRemaster = () => {
    if (!file) return;
    setProcessing(true);
    addToast("Initializing AI Remaster engine...", 'loading');
    
    // Simulate process
    let p = 0;
    const interval = setInterval(() => {
      p += 2;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setProcessing(false);
        setIsDone(true);
        addToast("Remaster complete! Your audio has been enhanced.", 'success');
      }
    }, 100);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 h-full flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">AI Remastering Studio</h2>
        <p className="text-gray-400">Restore old recordings or polish new demos with crystal clear quality.</p>
      </div>

      <div className="w-full max-w-2xl bg-wes-800/30 border border-dashed border-wes-600 rounded-3xl p-12 text-center transition-all hover:bg-wes-800/50 hover:border-wes-purple group">
        
        {!file ? (
          <>
            <div className="w-20 h-20 bg-wes-700/50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Upload className="w-10 h-10 text-gray-400 group-hover:text-wes-purple" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Drop your audio file here</h3>
            <p className="text-gray-500 mb-6">Supports MP3, WAV, FLAC (Max 50MB)</p>
            <label className="bg-white text-black px-6 py-3 rounded-full font-bold cursor-pointer hover:bg-gray-200 transition">
              Browse Files
              <input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
            </label>
          </>
        ) : !isDone ? (
          <div className="space-y-8">
             <div className="flex items-center justify-center space-x-4">
                <div className="w-12 h-12 bg-wes-purple/20 rounded-lg flex items-center justify-center">
                    <MusicIcon />
                </div>
                <div className="text-left">
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
             </div>

             {!processing && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {REMASTER_STYLES.map((style) => (
                        <button key={style} className="p-4 rounded-xl border border-wes-700 hover:border-wes-purple hover:bg-wes-700/30 transition flex items-center justify-between group">
                            <span className="text-gray-300 group-hover:text-white">{style}</span>
                            <div className="w-4 h-4 rounded-full border border-gray-500 group-hover:border-wes-purple"></div>
                        </button>
                    ))}
                 </div>
             )}

             {processing ? (
                 <div className="w-full bg-wes-900 rounded-full h-4 overflow-hidden relative">
                    <div 
                        className="h-full bg-gradient-to-r from-wes-purple to-blue-500 transition-all duration-100" 
                        style={{ width: `${progress}%` }}
                    ></div>
                    <p className="absolute w-full text-center text-[10px] text-white top-0 h-full flex items-center justify-center tracking-wider">
                        PROCESSING WAVEFORMS... {progress}%
                    </p>
                 </div>
             ) : (
                <button 
                  onClick={handleRemaster}
                  className="w-full py-4 bg-wes-purple hover:bg-purple-600 text-white font-bold rounded-xl transition shadow-lg shadow-purple-900/30 flex items-center justify-center space-x-2"
                >
                   <Sliders className="w-5 h-5" />
                   <span>Start Remastering</span>
                </button>
             )}
          </div>
        ) : (
            <div className="text-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Remaster Complete</h3>
                <p className="text-gray-400 mb-8">Your track has been enhanced with "Modern Clarity".</p>
                <div className="flex items-center justify-center space-x-4">
                    <button 
                        onClick={() => { setFile(null); setIsDone(false); }}
                        className="px-6 py-3 rounded-lg border border-wes-700 text-gray-300 hover:text-white"
                    >
                        Remaster Another
                    </button>
                    <button className="px-6 py-3 rounded-lg bg-white text-black font-bold hover:bg-gray-200">
                        Download Result
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const MusicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-wes-purple"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
);
