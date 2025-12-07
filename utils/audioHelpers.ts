export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const decodePCM = (base64: string): Float32Array => {
  const bytes = base64ToUint8Array(base64);
  const dataInt16 = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(dataInt16.length);
  
  for (let i = 0; i < dataInt16.length; i++) {
    float32Data[i] = dataInt16[i] / 32768.0;
  }
  return float32Data;
};

export const createWavBlob = (pcmData: Uint8Array, sampleRate: number = 24000): Blob => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  const headerSize = 44;
  new Uint8Array(buffer).set(pcmData, headerSize);

  return new Blob([buffer], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

// Helper to get a short snippet (max 15s) for AI analysis
export const getAudioSnippet = async (file: File, durationSeconds: number = 15): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create a new shorter buffer
  const length = Math.min(audioBuffer.length, audioBuffer.sampleRate * durationSeconds);
  const offlineCtx = new OfflineAudioContext(1, length, audioBuffer.sampleRate);
  
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();
  
  // Convert to WAV Blob then to Base64
  const wavBlob = bufferToWav(renderedBuffer);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(wavBlob);
  });
};


// --- AUDIO REMASTER ENGINE ---

export interface AudioFilterConfig {
  lowGain?: number; // Bass
  midGain?: number; // Mids
  highGain?: number; // Treble
  saturation?: boolean;
}

export const processAudio = async (
  file: File, 
  config: AudioFilterConfig, 
  onProgress: (progress: number) => void
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  // Create Filter Chain
  const lowShelf = offlineCtx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 200;
  lowShelf.gain.value = config.lowGain || 0;

  const midPeaking = offlineCtx.createBiquadFilter();
  midPeaking.type = 'peaking';
  midPeaking.frequency.value = 1500;
  midPeaking.Q.value = 1;
  midPeaking.gain.value = config.midGain || 0;

  const highShelf = offlineCtx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 3000;
  highShelf.gain.value = config.highGain || 0;

  // Simple Compressor to prevent clipping
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // Wiring: Source -> Low -> Mid -> High -> Compressor -> Destination
  source.connect(lowShelf);
  lowShelf.connect(midPeaking);
  midPeaking.connect(highShelf);
  highShelf.connect(compressor);
  compressor.connect(offlineCtx.destination);

  source.start(0);

  // Simulation of progress (OfflineContext renders as fast as possible, but we want to show UI)
  const renderPromise = offlineCtx.startRendering();
  
  // Fake progress interval while rendering happens
  const progressInterval = setInterval(() => {
     onProgress(Math.random() * 50); // Just initial movement
  }, 100);

  const renderedBuffer = await renderPromise;
  clearInterval(progressInterval);
  onProgress(100);

  // Encode back to WAV
  return bufferToWav(renderedBuffer);
};

// --- PROCEDURAL SYNTH ENGINE & MIXER ---

// Maps standard chord names to frequency arrays
const CHORD_MAP: Record<string, number[]> = {
    // C Major Scale
    'C': [261.63, 329.63, 392.00], 
    'Dm': [293.66, 349.23, 440.00],
    'Em': [329.63, 392.00, 493.88],
    'F': [349.23, 440.00, 523.25],
    'G': [392.00, 493.88, 587.33],
    'Am': [440.00, 523.25, 659.25], // A4, C5, E5
    'Bdim': [493.88, 587.33, 698.46],
    
    // Default fallback
    'Unknown': [261.63, 329.63, 392.00] 
};

const getChordFrequencies = (chordName: string): number[] => {
    // Simple lookup, strip extensions like "maj7" for basic synthesis
    const root = chordName.replace(/maj7|7|sus4|dim/, '');
    return CHORD_MAP[root] || CHORD_MAP[root.substring(0,2)] || CHORD_MAP['Unknown'];
};

// Simple Reverb Generator
const createReverbImpulse = (ctx: BaseAudioContext, duration: number = 2.0, decay: number = 2.0): AudioBuffer => {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    
    for (let i = 0; i < length; i++) {
        const n = i; // simple
        // Exponential decay
        const e = Math.pow(1 - n / length, decay);
        left[i] = (Math.random() * 2 - 1) * e;
        right[i] = (Math.random() * 2 - 1) * e;
    }
    return impulse;
};

export const generateProceduralBackingTrack = async (
    bpm: number,
    chordProgression: string[],
    genre: string,
    totalDuration: number
): Promise<AudioBuffer> => {
    const sampleRate = 24000;
    const offlineCtx = new OfflineAudioContext(2, sampleRate * totalDuration, sampleRate);
    
    const secondsPerBeat = 60 / bpm;
    // Length of the 4-bar loop in seconds
    const loopDuration = secondsPerBeat * 4 * 4; 
    
    // Create Master Mix
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 0.5;

    // Effects Bus (Reverb)
    const reverbConvolver = offlineCtx.createConvolver();
    reverbConvolver.buffer = createReverbImpulse(offlineCtx, 2.5, 3.0);
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = 0.3; // 30% wet

    masterGain.connect(offlineCtx.destination);
    masterGain.connect(reverbConvolver);
    reverbConvolver.connect(reverbGain);
    reverbGain.connect(offlineCtx.destination);

    // --- RHYTHM SECTION (Drums) ---
    // Simple Kick/Snare pattern based on genre
    const kickInterval = genre.includes('Metal') || genre.includes('Drum') ? secondsPerBeat / 2 : secondsPerBeat;
    
    for (let time = 0; time < totalDuration; time += kickInterval) {
        // Kick
        const osc = offlineCtx.createOscillator();
        const gain = offlineCtx.createGain();
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.5);

        // Hi-Hat (every half beat)
        if (genre !== 'Ambient Soundscape') {
            const noise = offlineCtx.createBufferSource();
            const noiseBuffer = offlineCtx.createBuffer(1, sampleRate * 0.05, sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < sampleRate * 0.05; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            noise.buffer = noiseBuffer;
            const hatGain = offlineCtx.createGain();
            hatGain.gain.setValueAtTime(0.1, time + (secondsPerBeat/2));
            hatGain.gain.exponentialRampToValueAtTime(0.01, time + (secondsPerBeat/2) + 0.05);
            
            // High pass filter for hat
            const filter = offlineCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 5000;
            
            noise.connect(filter);
            filter.connect(hatGain);
            hatGain.connect(masterGain);
            noise.start(time + (secondsPerBeat/2));
        }
    }

    // --- HARMONY SECTION (Chords/Pads) ---
    // Loop the progression
    let chordIndex = 0;
    const chordDuration = secondsPerBeat * 4; // 1 chord per bar

    for (let time = 0; time < totalDuration; time += chordDuration) {
        const chordName = chordProgression[chordIndex % chordProgression.length] || 'C';
        const freqs = getChordFrequencies(chordName);
        
        freqs.forEach((freq, idx) => {
            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();
            
            // Synth Type based on genre
            if (genre.includes('Retro') || genre.includes('Synthwave')) {
                osc.type = 'sawtooth';
                gain.gain.value = 0.06;
                // Detune slighty for width
                if (idx % 2 === 0) osc.detune.value = 10;
            } else if (genre.includes('Lo-Fi')) {
                osc.type = 'sine';
                gain.gain.value = 0.15;
            } else {
                osc.type = 'triangle';
                gain.gain.value = 0.08;
            }

            // Envelope
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(gain.gain.value, time + 0.1); // Attack
            gain.gain.linearRampToValueAtTime(0, time + chordDuration - 0.1); // Release

            osc.frequency.value = freq;
            
            // Simple LPF for smoother sound
            const lpf = offlineCtx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.value = 1000;
            
            // Pan separation
            const panner = offlineCtx.createStereoPanner();
            panner.pan.value = (idx % 2 === 0) ? -0.3 : 0.3; // Slight stereo spread

            osc.connect(lpf);
            lpf.connect(gain);
            gain.connect(panner);
            panner.connect(masterGain);
            
            osc.start(time);
            osc.stop(time + chordDuration);
        });
        
        chordIndex++;
    }

    return await offlineCtx.startRendering();
};

export const mixAudioTracks = async (
    vocalBufferBase64: string,
    backingTrackBuffer: AudioBuffer
): Promise<Blob> => {
    const vocalPcm = decodePCM(vocalBufferBase64);
    const sampleRate = 24000; // Standard for Gemini TTS
    
    // Determine total length (max of vocal or backing)
    // Note: vocalPcm is at 24000 sample rate. backingTrackBuffer is likely same.
    const finalLength = Math.max(vocalPcm.length, backingTrackBuffer.length);
    
    const offlineCtx = new OfflineAudioContext(2, finalLength, sampleRate);
    
    // Vocal Source
    const vocalBuffer = offlineCtx.createBuffer(1, vocalPcm.length, sampleRate);
    vocalBuffer.copyToChannel(vocalPcm as any, 0); 
    
    const vocalSource = offlineCtx.createBufferSource();
    vocalSource.buffer = vocalBuffer;
    
    const vocalGain = offlineCtx.createGain();
    vocalGain.gain.value = 1.0; // Keep vocals loud
    
    vocalSource.connect(vocalGain);
    vocalGain.connect(offlineCtx.destination);
    vocalSource.start(0);
    
    // Backing Source
    const backingSource = offlineCtx.createBufferSource();
    backingSource.buffer = backingTrackBuffer;
    
    const backingGain = offlineCtx.createGain();
    backingGain.gain.value = 0.8; 

    backingSource.connect(backingGain);
    backingGain.connect(offlineCtx.destination);
    backingSource.start(0);

    const rendered = await offlineCtx.startRendering();
    return bufferToWav(rendered);
};

// Helper to convert AudioBuffer to WAV Blob
const bufferToWav = (abuffer: AudioBuffer) => {
  const numOfChan = abuffer.numberOfChannels;
  const length = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded in this parser)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < abuffer.length) {
    for (i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([buffer], { type: 'audio/wav' });

  function setUint16(data: any) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: any) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};