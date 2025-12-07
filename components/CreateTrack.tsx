
import React, { useState } from 'react';
import { GENRES, MOODS } from '../constants';
import { GenerationParams, Song } from '../types';
import { generateSongConcept, generateCoverArt, generateVocals } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { base64ToUint8Array, createWavBlob } from '../utils/audioHelpers';
import { Wand2, Music, Loader2, Zap } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface CreateTrackProps {
  onTrackCreated: (track: Song) => void;
}

export const CreateTrack: React.FC<CreateTrackProps> = ({ onTrackCreated }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<string>('idle'); 
  const { addToast } = useToast();

  const [formData, setFormData] = useState<GenerationParams>({
    genre: GENRES[0],
    mood: MOODS[0],
    description: '',
    hasVocals: true,
    customLyrics: '',
    voiceName: 'Kore'
  });

  const uploadAsset = async (blob: Blob, bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
       contentType: blob.type,
       upsert: true
    });
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStep('composing');

    try {
      // 1. Concept
      const concept = await generateSongConcept(formData);
      
      setStep('producing');

      // 2. Asset Generation
      const artPromise = generateCoverArt(concept);
      let audioPromise = Promise.resolve("");

      if (formData.hasVocals && concept.lyrics) {
         audioPromise = generateVocals(concept.lyrics, formData.voiceName);
      }

      const [artBase64, audioBase64] = await Promise.all([artPromise, audioPromise]);

      setStep('saving');

      // 3. Process & Upload to Supabase
      const trackId = crypto.randomUUID();
      let coverUrl = "";
      let audioUrl = "";

      // Upload Cover
      if (artBase64) {
          const res = await fetch(artBase64);
          const blob = await res.blob();
          coverUrl = await uploadAsset(blob, 'covers', `${trackId}.png`);
      }

      // Upload Audio
      if (audioBase64) {
          const pcmData = base64ToUint8Array(audioBase64);
          const wavBlob = createWavBlob(pcmData, 24000); // 24kHz standard for Gemini TTS
          audioUrl = await uploadAsset(wavBlob, 'audio', `${trackId}.wav`);
      }

      // 4. Save to DB
      const newSongData: Partial<Song> = {
        id: trackId,
        title: concept.title || "Untitled Track",
        artist: "WesAI User",
        genre: formData.genre,
        mood: formData.mood,
        lyrics: concept.lyrics || [],
        coverArtUrl: coverUrl,
        audioUrl: audioUrl, // Now a real URL
        duration: concept.duration || 180,
        createdAt: new Date(),
        status: 'ready',
        bpm: concept.bpm,
        instruments: concept.instruments,
        type: 'original',
        description: concept.description
      };

      const { data, error: dbError } = await supabase
        .from('tracks')
        .insert([{
             id: trackId,
             title: newSongData.title,
             artist: newSongData.artist,
             genre: newSongData.genre,
             mood: newSongData.mood,
             lyrics: newSongData.lyrics,
             cover_art_url: coverUrl,
             audio_url: audioUrl,
             duration: newSongData.duration,
             bpm: newSongData.bpm,
             instruments: newSongData.instruments,
             description: newSongData.description,
             type: 'original'
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      // Map back to Song type
      const newSong: Song = {
          ...newSongData,
          createdAt: new Date(data.created_at)
      } as Song;

      addToast(`Track "${newSong.title}" created successfully.`, 'success');
      onTrackCreated(newSong);

    } catch (err) {
      console.error(err);
      addToast("Failed to generate track. Please try again.", 'error');
    } finally {
      setLoading(false);
      setStep('idle');
    }
  };

  const getStepLabel = () => {
      switch(step) {
          case 'composing': return 'Composing Lyrics & Structure...';
          case 'producing': return 'Parallel Processing: Art & Vocals...';
          case 'saving': return 'Mastering & Uploading to Cloud...';
          default: return 'Generate Track';
      }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
            <h2 className="text-3xl font-bold text-white mb-2">Create New Track</h2>
            <p className="text-gray-400">Describe your vision, and WesAI will arrange the composition.</p>
        </div>
        <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-wes-800 rounded-full border border-wes-700">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-mono text-gray-300">TURBO MODE ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Genre</label>
                <select 
                  className="w-full bg-wes-800 border border-wes-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-wes-purple focus:outline-none"
                  value={formData.genre}
                  onChange={(e) => setFormData({...formData, genre: e.target.value})}
                >
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Mood</label>
                <select 
                  className="w-full bg-wes-800 border border-wes-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-wes-purple focus:outline-none"
                  value={formData.mood}
                  onChange={(e) => setFormData({...formData, mood: e.target.value})}
                >
                  {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Vibe Description</label>
              <textarea 
                className="w-full bg-wes-800 border border-wes-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-wes-purple focus:outline-none h-24 resize-none"
                placeholder="E.g., A driving beat for a late night drive through Tokyo..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Lyrics (Optional)</label>
              <textarea 
                className="w-full bg-wes-800 border border-wes-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-wes-purple focus:outline-none h-32 resize-none font-mono text-sm"
                placeholder="Paste your lyrics here, or leave empty for AI generation..."
                value={formData.customLyrics}
                onChange={(e) => setFormData({...formData, customLyrics: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-4 border border-wes-700 rounded-xl bg-wes-800/30">
                <input 
                    type="checkbox" 
                    id="hasVocals"
                    className="w-5 h-5 rounded border-gray-600 text-wes-purple focus:ring-wes-purple bg-wes-800"
                    checked={formData.hasVocals}
                    onChange={(e) => setFormData({...formData, hasVocals: e.target.checked})}
                />
                <label htmlFor="hasVocals" className="text-gray-300">Include Vocals</label>
                </div>

                <div className="flex flex-col justify-center">
                    <label className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Voice Profile</label>
                    <select 
                        className="bg-wes-800 border-none text-white text-sm focus:ring-0 cursor-pointer"
                        value={formData.voiceName}
                        onChange={(e) => setFormData({...formData, voiceName: e.target.value})}
                        disabled={!formData.hasVocals}
                    >
                        <option value="Kore">Kore (Balanced)</option>
                        <option value="Fenrir">Fenrir (Deep)</option>
                        <option value="Puck">Puck (Energetic)</option>
                        <option value="Zephyr">Zephyr (Soft)</option>
                    </select>
                </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all ${
                loading 
                  ? 'bg-wes-800 cursor-not-allowed text-gray-500' 
                  : 'bg-gradient-to-r from-wes-purple to-blue-600 hover:shadow-lg hover:shadow-purple-900/40 text-white'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5" />
                  <span>{getStepLabel()}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>Generate Track</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Preview / Tips Section */}
        <div className="space-y-6">
           <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-white font-semibold mb-4 flex items-center">
                <Music className="w-4 h-4 text-wes-purple mr-2" />
                Pro Tips
              </h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start">
                  <span className="text-wes-purple mr-2">•</span>
                  Try mixing contrasting genres like "Jazz" and "Metal" for unique results.
                </li>
                <li className="flex items-start">
                  <span className="text-wes-purple mr-2">•</span>
                  Provide specific instruments in the description (e.g., "Heavy 808s and violin").
                </li>
                <li className="flex items-start">
                  <span className="text-wes-purple mr-2">•</span>
                  OneSound optimizes for "Radio Edit" length (approx 3 mins).
                </li>
              </ul>
           </div>
           
           <div className="bg-gradient-to-br from-wes-800 to-wes-900 p-6 rounded-2xl border border-wes-700 text-center">
              <p className="text-gray-500 text-sm mb-2">Available Credits</p>
              <p className="text-3xl font-mono font-bold text-white">∞ <span className="text-sm font-normal text-gray-600">Free Tier</span></p>
           </div>
        </div>
      </div>
    </div>
  );
};
