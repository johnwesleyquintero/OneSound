import React, { useState } from 'react';
import { GENRES, MOODS } from '../constants';
import { GenerationParams, Song } from '../types';
import { generateSongConcept, generateCoverArt, generateVocals } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { base64ToUint8Array, createWavBlob } from '../utils/audioHelpers';
import { Wand2, Music, Loader2, Zap, Edit3, Save, PlayCircle, RefreshCcw, Coffee, CassetteTape, Sword, Mountain, Sparkles, Users } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface CreateTrackProps {
  onTrackCreated: (track: Song) => void;
}

const TEMPLATES = [
  { 
    id: 'lofi', 
    label: 'Lo-Fi Study', 
    icon: Coffee, 
    genre: 'Lo-Fi Hip Hop', 
    mood: 'Chill', 
    voice: 'Zephyr',
    description: 'Dusty vinyl crackle, mellow jazz piano chords, soft boom bap beat, raining outside atmosphere.' 
  },
  { 
    id: 'nostalgia', 
    label: '80s Nostalgia', 
    icon: CassetteTape, 
    genre: 'Cyberpunk Synthwave', 
    mood: 'Euphoric', 
    voice: 'Kore',
    description: 'Neon soaked streets, analog synthesizers, gated reverb drums, late night drive vibes, retro future.' 
  },
  { 
    id: 'ost', 
    label: 'Anime OST', 
    icon: Sword, 
    genre: 'Indie Pop', 
    mood: 'Energetic', 
    voice: 'Puck',
    description: 'High energy opening theme for a shonen anime, driving guitar riffs, emotional build up, power of friendship.' 
  },
  { 
    id: 'cinematic', 
    label: 'Cinematic', 
    icon: Mountain, 
    genre: 'Orchestral Cinematic', 
    mood: 'Focus', 
    voice: 'Fenrir',
    description: 'Hans Zimmer style crescendo, massive string section, thunderous percussion, epic choir, wide soundstage.' 
  }
];

export const CreateTrack: React.FC<CreateTrackProps> = ({ onTrackCreated }) => {
  const { addToast } = useToast();
  
  // Phase 1: Input -> Concept
  // Phase 2: Edit Concept
  // Phase 3: Production (Art + Audio)
  const [phase, setPhase] = useState<'input' | 'drafting' | 'production'>('input');
  const [loading, setLoading] = useState(false);
  const [draftTrack, setDraftTrack] = useState<Partial<Song> | null>(null);

  const [formData, setFormData] = useState<GenerationParams>({
    genre: GENRES[0],
    mood: MOODS[0],
    description: '',
    hasVocals: true,
    customLyrics: '',
    voiceName: 'Kore',
    isDuet: false,
    secondaryVoiceName: 'Puck'
  });

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setFormData({
      ...formData,
      genre: template.genre,
      mood: template.mood,
      description: template.description,
      voiceName: template.voice,
      isDuet: false // Reset duet on template apply to keep it simple
    });
    addToast(`Applied "${template.label}" template.`, 'info');
  };

  const uploadAsset = async (blob: Blob, bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
       contentType: blob.type,
       upsert: true
    });
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  // STEP 1: Generate Concept (Lyrics & Metadata)
  const handleGenerateConcept = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    addToast(formData.isDuet ? "Arranging duet structure..." : "Brainstorming composition...", "loading");

    try {
      const concept = await generateSongConcept(formData);
      setDraftTrack(concept);
      setPhase('drafting');
      addToast("Draft created! Review the lyrics before producing.", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to generate concept.", "error");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Production (Audio & Art)
  const handleProduction = async () => {
    if (!draftTrack) return;
    setPhase('production');
    setLoading(true);
    addToast("Entering production phase...", "loading");

    try {
      // Parallel Generation
      const artPromise = generateCoverArt(draftTrack);
      let audioPromise = Promise.resolve("");

      if (formData.hasVocals && draftTrack.lyrics) {
         audioPromise = generateVocals(
            draftTrack.lyrics, 
            formData.voiceName || 'Kore',
            formData.isDuet ? formData.secondaryVoiceName : undefined
         );
      }

      const [artBase64, audioBase64] = await Promise.all([artPromise, audioPromise]);

      const trackId = crypto.randomUUID();
      
      // Default to local/memory data first
      let coverUrl = artBase64; 
      let audioUrl = ""; 
      
      let audioBlob: Blob | null = null;
      if (audioBase64) {
          const pcmData = base64ToUint8Array(audioBase64);
          audioBlob = createWavBlob(pcmData, 24000); // 24kHz standard for Gemini TTS
          audioUrl = URL.createObjectURL(audioBlob);
      }

      // Try uploading to Supabase (Graceful Fallback)
      try {
          if (artBase64) {
              const res = await fetch(artBase64);
              const blob = await res.blob();
              const uploadedCover = await uploadAsset(blob, 'covers', `${trackId}.png`);
              if (uploadedCover) coverUrl = uploadedCover;
          }

          if (audioBlob) {
              const uploadedAudio = await uploadAsset(audioBlob, 'audio', `${trackId}.wav`);
              if (uploadedAudio) audioUrl = uploadedAudio;
          }
      } catch (uploadError) {
          console.warn("Cloud upload failed, falling back to local session:", uploadError);
          addToast("Cloud storage unavailable. Track saved to local session.", 'info');
      }

      // Construct Song Object
      const newSongData: Song = {
        id: trackId,
        title: draftTrack.title || "Untitled Track",
        artist: "WesAI User",
        genre: formData.genre,
        mood: formData.mood,
        lyrics: draftTrack.lyrics || [],
        coverArtUrl: coverUrl,
        audioUrl: audioUrl, 
        duration: draftTrack.duration || 180,
        createdAt: new Date(),
        status: 'ready',
        bpm: draftTrack.bpm,
        instruments: draftTrack.instruments,
        type: 'original',
        description: draftTrack.description,
        isDuet: formData.isDuet,
        secondaryVoiceName: formData.secondaryVoiceName
      };

      // Try inserting into DB
      try {
        const { error: dbError } = await supabase
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
            }]);
            
        if (dbError) throw dbError;
        addToast(`Track "${newSongData.title}" saved to cloud.`, 'success');

      } catch (dbError) {
          console.warn("Database save failed:", dbError);
      }

      onTrackCreated(newSongData);

    } catch (err) {
      console.error(err);
      addToast("Failed to produce track. Please try again.", 'error');
      setPhase('drafting'); // Go back to draft if failed
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDraft = (field: string, value: any) => {
      if (!draftTrack) return;
      setDraftTrack({ ...draftTrack, [field]: value });
  };

  const handleLyricsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!draftTrack) return;
      const lines = e.target.value.split('\n');
      setDraftTrack({ ...draftTrack, lyrics: lines });
  };

  const VoiceOptions = () => (
    <>
        <option value="Kore">Kore (Balanced)</option>
        <option value="Fenrir">Fenrir (Deep)</option>
        <option value="Puck">Puck (Energetic)</option>
        <option value="Zephyr">Zephyr (Soft)</option>
    </>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
            <h2 className="text-3xl font-bold text-white mb-2">
                {phase === 'input' ? 'Create New Track' : phase === 'drafting' ? 'Studio Editor' : 'Mastering...'}
            </h2>
            <p className="text-gray-400">
                {phase === 'input' ? 'Describe your vision, and WesAI will arrange the composition.' : 'Refine your lyrics and structure before recording.'}
            </p>
        </div>
        {phase === 'input' && (
            <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-wes-800 rounded-full border border-wes-700">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-mono text-gray-300">TURBO MODE ACTIVE</span>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* === LEFT PANEL: CONTROLS === */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-2xl relative overflow-hidden">
            
            {phase === 'production' && (
                <div className="absolute inset-0 z-20 bg-wes-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-16 h-16 text-wes-purple animate-spin mb-4" />
                    <h3 className="text-2xl font-bold text-white">Producing Track...</h3>
                    <p className="text-gray-400 mt-2">Synthesizing Vocals • Generating Artwork • Mastering Audio</p>
                </div>
            )}

            {phase === 'input' ? (
                // --- PHASE 1: INPUT FORM ---
                <form onSubmit={handleGenerateConcept} className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    
                    {/* Templates Section */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Quick Start Templates</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => applyTemplate(t)}
                            className={`p-3 rounded-xl border transition-all duration-200 flex flex-col items-center text-center space-y-2 hover:scale-105 ${
                              formData.description === t.description 
                                ? 'bg-wes-purple/20 border-wes-purple text-white' 
                                : 'bg-wes-800 border-wes-700 text-gray-400 hover:bg-wes-800/80 hover:text-white'
                            }`}
                          >
                             <t.icon className="w-6 h-6" />
                             <span className="text-xs font-bold">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-wes-700 w-full my-6"></div>

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
                    <div className="relative">
                      <textarea 
                          className="w-full bg-wes-800 border border-wes-700 text-white rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-wes-purple focus:outline-none h-24 resize-none"
                          placeholder="E.g., A driving beat for a late night drive through Tokyo..."
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          required
                      />
                      <Sparkles className="absolute right-3 top-3 w-4 h-4 text-wes-purple opacity-50" />
                    </div>
                    </div>

                    <div className="bg-wes-800/40 p-4 rounded-xl border border-wes-700 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <input 
                                    type="checkbox" 
                                    id="hasVocals"
                                    className="w-5 h-5 rounded border-gray-600 text-wes-purple focus:ring-wes-purple bg-wes-800"
                                    checked={formData.hasVocals}
                                    onChange={(e) => setFormData({...formData, hasVocals: e.target.checked})}
                                />
                                <label htmlFor="hasVocals" className="text-white font-medium">Include Vocals</label>
                            </div>
                            
                            {formData.hasVocals && (
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="isDuet" className={`text-sm font-bold cursor-pointer transition-colors ${formData.isDuet ? 'text-wes-purple' : 'text-gray-500'}`}>
                                        Duet Mode
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, isDuet: !prev.isDuet }))}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.isDuet ? 'bg-wes-purple' : 'bg-wes-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${formData.isDuet ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {formData.hasVocals && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider block">
                                        {formData.isDuet ? 'Lead Voice' : 'Voice Profile'}
                                    </label>
                                    <select 
                                        className="w-full bg-wes-800 border border-wes-700 text-white text-sm focus:ring-2 focus:ring-wes-purple cursor-pointer rounded-lg p-2.5 transition"
                                        value={formData.voiceName}
                                        onChange={(e) => setFormData({...formData, voiceName: e.target.value})}
                                    >
                                        <VoiceOptions />
                                    </select>
                                </div>
                                {formData.isDuet && (
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider block">Feature Voice</label>
                                        <select 
                                            className="w-full bg-wes-800 border border-wes-700 text-white text-sm focus:ring-2 focus:ring-wes-purple cursor-pointer rounded-lg p-2.5 transition"
                                            value={formData.secondaryVoiceName}
                                            onChange={(e) => setFormData({...formData, secondaryVoiceName: e.target.value})}
                                        >
                                            <VoiceOptions />
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
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
                            <span>Brainstorming...</span>
                            </>
                        ) : (
                            <>
                            <Edit3 className="w-5 h-5" />
                            <span>Draft Concept</span>
                            </>
                        )}
                    </button>
                </form>
            ) : (
                // --- PHASE 2: DRAFTING EDITOR ---
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                    <div className="flex items-center space-x-4 border-b border-wes-700 pb-4">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 uppercase font-bold">Track Title</label>
                            <input 
                                type="text" 
                                value={draftTrack?.title || ""} 
                                onChange={(e) => handleUpdateDraft('title', e.target.value)}
                                className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none border-b border-transparent focus:border-wes-purple transition-colors placeholder-gray-600"
                                placeholder="Untitled Track"
                            />
                        </div>
                        <div className="text-right">
                             <p className="text-xs text-gray-500 uppercase font-bold">BPM</p>
                             <p className="text-xl font-mono text-wes-purple">{draftTrack?.bpm || 120}</p>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                             <div className="flex items-center space-x-2">
                                <label className="text-xs text-gray-500 uppercase font-bold">Lyrics Editor</label>
                                {formData.isDuet && <span className="text-[10px] bg-wes-purple/20 text-wes-purple px-2 py-0.5 rounded border border-wes-purple/50">Duet Mode</span>}
                             </div>
                             <button 
                                type="button" 
                                onClick={() => setPhase('input')}
                                className="text-xs text-red-400 hover:underline flex items-center"
                             >
                                <RefreshCcw className="w-3 h-3 mr-1" /> Discard
                             </button>
                        </div>
                        <textarea 
                            className="flex-1 w-full bg-wes-800/50 border border-wes-700 text-gray-100 rounded-xl p-6 focus:ring-2 focus:ring-wes-purple focus:outline-none resize-none font-mono leading-relaxed"
                            value={draftTrack?.lyrics?.join('\n') || ""}
                            onChange={handleLyricsChange}
                            placeholder="Lyrics will appear here..."
                            style={{ minHeight: '300px' }}
                        />
                        <p className="text-xs text-gray-500 mt-2 text-right">
                            {formData.isDuet 
                             ? "Tip: Use 'Speaker 1:' and 'Speaker 2:' to assign lines." 
                             : "Edit lines to adjust phrasing. Empty lines create pauses."}
                        </p>
                    </div>

                    <button 
                        onClick={handleProduction}
                        className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-500 hover:shadow-lg hover:shadow-green-900/40 text-white transition-all"
                    >
                        <PlayCircle className="w-5 h-5" />
                        <span>Produce Track (Finalize)</span>
                    </button>
                </div>
            )}
        </div>

        {/* === RIGHT PANEL: INFO & TIPS === */}
        <div className="space-y-6">
           <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-white font-semibold mb-4 flex items-center">
                <Music className="w-4 h-4 text-wes-purple mr-2" />
                {phase === 'drafting' ? 'Editor Controls' : 'Pro Tips'}
              </h3>
              
              {phase === 'drafting' ? (
                  <ul className="space-y-3 text-sm text-gray-400">
                     <li className="flex items-start">
                        <span className="text-wes-purple mr-2 font-bold">1.</span>
                        Review the generated lyrics carefully.
                     </li>
                     <li className="flex items-start">
                        <span className="text-wes-purple mr-2 font-bold">2.</span>
                        Remove [Chorus] or [Verse] tags if you don't want them spoken.
                     </li>
                     <li className="flex items-start">
                        <span className="text-wes-purple mr-2 font-bold">3.</span>
                        {formData.isDuet ? (
                            <span>Duet Active: Keep the <strong>Speaker 1:</strong> and <strong>Speaker 2:</strong> prefixes intact.</span>
                        ) : (
                            <span>Use punctuation to control rhythm. Commas add short pauses.</span>
                        )}
                     </li>
                  </ul>
              ) : (
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li className="flex items-start">
                    <span className="text-wes-purple mr-2">•</span>
                    Use the Templates to get engineered prompts.
                    </li>
                    <li className="flex items-start">
                    <span className="text-wes-purple mr-2">•</span>
                    Enable <strong>Duet Mode</strong> to create dynamic conversations between two AI voices.
                    </li>
                     <li className="flex items-start">
                    <span className="text-wes-purple mr-2">•</span>
                    Try mixing contrasting genres like "Jazz" and "Metal".
                    </li>
                  </ul>
              )}
           </div>
           
           <div className="bg-gradient-to-br from-wes-800 to-wes-900 p-6 rounded-2xl border border-wes-700 text-center">
              <p className="text-gray-500 text-sm mb-2">Estimated Duration</p>
              <p className="text-3xl font-mono font-bold text-white">
                  {draftTrack?.duration ? `${Math.floor(draftTrack.duration / 60)}:${(draftTrack.duration % 60).toString().padStart(2, '0')}` : "~03:00"}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};