import React, { useState, useRef } from 'react';
import { Upload, Sliders, CheckCircle2, Play, Download, RefreshCw, Loader2 } from 'lucide-react';
import { REMASTER_STYLES } from '../constants';
import { useToast } from '../context/ToastContext';
import { processAudio, AudioFilterConfig } from '../utils/audioHelpers';

export const RemasterTrack: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { addToast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 50 * 1024 * 1024) {
        addToast("File size too large. Max 50MB.", 'error');
        return;
      }
      setFile(selectedFile);
      setResultBlob(null);
      setResultUrl(null);
      setProgress(0);
      addToast(`File loaded: ${selectedFile.name}`, 'info');
    }
  };

  const getFilterConfig = (style: string): AudioFilterConfig => {
    switch (style) {
      case "Modern Clarity (AI Clean)": return { lowGain: -2, midGain: 2, highGain: 6 };
      case "Vintage Tape Saturation": return { lowGain: 3, midGain: -2, highGain: -5 };
      case "Warm Tube Amp": return { lowGain: 5, midGain: 3, highGain: -2 };
      case "Bass Boosted & Punchy": return { lowGain: 12, midGain: -1, highGain: 2 };
      case "Vocal Isolation": return { lowGain: -20, midGain: 10, highGain: -5 };
      default: return { lowGain: 0, midGain: 0, highGain: 0 };
    }
  };

  const handleRemaster = async (style: string) => {
    if (!file) return;
    setProcessing(true);
    setProgress(10);
    addToast(`Applying "${style}" filters...`, 'loading');
    
    try {
        const config = getFilterConfig(style);
        
        // Use a short timeout to allow UI to render the loading state before the heavy thread work
        setTimeout(async () => {
            try {
                const processedBlob = await processAudio(file, config, (p) => setProgress(p));
                const url = URL.createObjectURL(processedBlob);
                
                setResultBlob(processedBlob);
                setResultUrl(url);
                setProcessing(false);
                addToast("Remaster complete! Audio engine has rendered the file.", 'success');
            } catch (err) {
                console.error(err);
                setProcessing(false);
                addToast("Error processing audio. File might be corrupted.", 'error');
            }
        }, 500);

    } catch (e) {
        setProcessing(false);
        addToast("Critical Engine Failure", 'error');
    }
  };

  const handleDownload = () => {
      if (resultUrl && file) {
          const a = document.createElement('a');
          a.href = resultUrl;
          a.download = `remastered_${file.name.replace(/\.[^/.]+$/, "")}.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 h-full flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">AI Remastering Studio</h2>
        <p className="text-gray-400">Restore old recordings using our browser-based Neural DSP engine.</p>
      </div>

      <div className="w-full max-w-2xl bg-wes-800/30 border border-dashed border-wes-600 rounded-3xl p-12 text-center transition-all hover:bg-wes-800/50 hover:border-wes-purple group relative overflow-hidden">
        
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
        ) : !resultUrl ? (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
             <div className="flex items-center justify-center space-x-4">
                <div className="w-12 h-12 bg-wes-purple/20 rounded-lg flex items-center justify-center">
                    <MusicIcon />
                </div>
                <div className="text-left">
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                    onClick={() => setFile(null)} 
                    className="p-2 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-full transition"
                >
                    <RefreshCw size={16} />
                </button>
             </div>

             {!processing && (
                 <>
                    <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">Select Processing Chain</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                        {REMASTER_STYLES.map((style) => (
                            <button 
                                key={style} 
                                onClick={() => handleRemaster(style)}
                                className="p-4 rounded-xl border border-wes-700 hover:border-wes-purple hover:bg-wes-700/30 transition flex items-center justify-between group"
                            >
                                <span className="text-gray-300 group-hover:text-white text-sm font-medium">{style}</span>
                                <div className="w-4 h-4 rounded-full border border-gray-500 group-hover:border-wes-purple"></div>
                            </button>
                        ))}
                    </div>
                 </>
             )}

             {processing && (
                 <div className="py-12">
                     <Loader2 className="w-12 h-12 text-wes-purple animate-spin mx-auto mb-4" />
                     <p className="text-white font-mono animate-pulse">RENDERING AUDIO...</p>
                     <div className="w-full max-w-sm mx-auto bg-wes-900 rounded-full h-2 mt-4 overflow-hidden">
                        <div className="h-full bg-wes-purple transition-all duration-300" style={{width: `${progress}%`}}></div>
                     </div>
                 </div>
             )}
          </div>
        ) : (
            <div className="text-center animate-in fade-in zoom-in duration-300 space-y-8">
                <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                
                <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Remaster Complete</h3>
                    <p className="text-gray-400">Audio has been processed and re-encoded.</p>
                </div>

                <div className="bg-wes-900/50 p-6 rounded-2xl border border-wes-700">
                    <audio 
                        ref={audioRef} 
                        src={resultUrl} 
                        controls 
                        className="w-full"
                    />
                </div>

                <div className="flex items-center justify-center space-x-4">
                    <button 
                        onClick={() => { setFile(null); setResultUrl(null); }}
                        className="px-6 py-3 rounded-lg border border-wes-700 text-gray-300 hover:text-white hover:bg-wes-800 transition"
                    >
                        Process New File
                    </button>
                    <button 
                        onClick={handleDownload}
                        className="px-6 py-3 rounded-lg bg-white text-black font-bold hover:bg-gray-200 transition flex items-center"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download WAV
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