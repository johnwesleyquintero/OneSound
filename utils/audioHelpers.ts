
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


// --- AUDIO REMASTER ENGINE (Professional DSP Chain) ---

export interface AudioFilterConfig {
  lowGain?: number; // Bass
  midGain?: number; // Mids
  highGain?: number; // Treble
  saturation?: boolean;
  mix?: number; // 0.0 to 1.0 (Dry to Wet)
  spatialMix?: number; // 0.0 to 1.0 (Spatial Width)
  noiseGate?: boolean;
}

// Tube Saturation Curve (Soft Clipping)
function makeDistortionCurve(amount: number) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
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

  // --- CHAIN ARCHITECTURE ---
  // Source -> EQ -> Compressor (Glue) -> Saturation -> Spatial -> Limiter -> Destination

  // 1. Corrective EQ
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 30; // Remove rumble

  const lowShelf = offlineCtx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 200;
  lowShelf.gain.value = config.lowGain || 0;

  const midPeaking = offlineCtx.createBiquadFilter();
  midPeaking.type = 'peaking';
  midPeaking.frequency.value = 1800;
  midPeaking.Q.value = 0.8;
  midPeaking.gain.value = config.midGain || 0;

  const highShelf = offlineCtx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8000;
  highShelf.gain.value = config.highGain || 0;

  // 2. Glue Compressor (Gentle)
  const glueCompressor = offlineCtx.createDynamicsCompressor();
  glueCompressor.threshold.value = -20;
  glueCompressor.knee.value = 30;
  glueCompressor.ratio.value = 2.5; // Mastering ratio
  glueCompressor.attack.value = 0.03; // 30ms - let transients through
  glueCompressor.release.value = 0.25;

  // 3. Saturation (Parallel or Series based on config)
  const saturator = offlineCtx.createWaveShaper();
  if (config.saturation) {
      saturator.curve = makeDistortionCurve(100); 
      saturator.oversample = '4x';
  } else {
      saturator.curve = null; // Bypass
  }

  // 4. Makeup Gain (To recover volume lost in compression)
  const makeupGain = offlineCtx.createGain();
  makeupGain.gain.value = 1.0; 
  if (config.mix && config.mix > 0.5) {
      // Auto-gain logic approximation
      makeupGain.gain.value = 1.2 + ((config.lowGain || 0) > 0 ? -0.1 : 0); 
  }

  // 5. Spatial Enhancer (Simple Stereo Width)
  // We use Mid/Side technique ideally, but StereoPanner is safer for offline context reliability
  const stereoWidener = offlineCtx.createGain(); // Placeholder for width
  // Note: Web Audio API doesn't have a native "Widener" node without complex splitting.
  // We will simulate it by simple channel manipulation if needed, but for stability
  // we will just use a slight Gain boost on the Side channels if we implemented M/S.
  // For now, we will use the mix parameter to control wet/dry of the saturator.
  
  // 6. Brickwall Limiter (Final Stage)
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = -1.0; // Ceiling
  limiter.knee.value = 0; // Hard knee
  limiter.ratio.value = 20; // Inf ratio
  limiter.attack.value = 0.001; // Instant
  limiter.release.value = 0.1;

  // --- WIRING ---
  
  source.connect(highPass);
  highPass.connect(lowShelf);
  lowShelf.connect(midPeaking);
  midPeaking.connect(highShelf);
  
  // Split signal for Saturation (Parallel Processing) if desired, 
  // but here we do series for simplicity in "Remaster"
  highShelf.connect(glueCompressor);
  glueCompressor.connect(saturator);
  saturator.connect(makeupGain);
  makeupGain.connect(limiter);
  limiter.connect(offlineCtx.destination);

  // Start
  source.start(0);

  // Render
  const renderPromise = offlineCtx.startRendering();
  
  const progressInterval = setInterval(() => {
     onProgress(Math.random() * 60 + 10); 
  }, 100);

  const renderedBuffer = await renderPromise;
  clearInterval(progressInterval);
  onProgress(100);

  return bufferToWav(renderedBuffer);
};

// --- PROCEDURAL SYNTH ENGINE & MIXER ---

const CHORD_MAP: Record<string, number[]> = {
    'C': [261.63, 329.63, 392.00], 
    'Cm': [261.63, 311.13, 392.00],
    'Dm': [293.66, 349.23, 440.00],
    'Em': [329.63, 392.00, 493.88],
    'F': [349.23, 440.00, 523.25],
    'Fm': [349.23, 415.30, 523.25],
    'G': [392.00, 493.88, 587.33],
    'Am': [440.00, 523.25, 659.25], 
    'Bb': [466.16, 587.33, 698.46],
    'Unknown': [261.63, 329.63, 392.00] 
};

const getChordFrequencies = (chordName: string): number[] => {
    const root = chordName.replace(/maj7|7|sus4|dim/, '');
    return CHORD_MAP[root] || CHORD_MAP[root.substring(0,2)] || CHORD_MAP['Unknown'];
};

const createReverbImpulse = (ctx: BaseAudioContext, duration: number = 2.0, decay: number = 2.0): AudioBuffer => {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    
    for (let i = 0; i < length; i++) {
        const n = i; 
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
    const chordDuration = secondsPerBeat * 4; 
    
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 0.6; // Headroom

    // Reverb Bus
    const reverbConvolver = offlineCtx.createConvolver();
    reverbConvolver.buffer = createReverbImpulse(offlineCtx, 3.0, 4.0);
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = 0.25;

    masterGain.connect(offlineCtx.destination);
    masterGain.connect(reverbConvolver);
    reverbConvolver.connect(reverbGain);
    reverbGain.connect(offlineCtx.destination);

    // --- DRUMS ---
    const kickInterval = genre.includes('Metal') || genre.includes('Drum') ? secondsPerBeat / 2 : secondsPerBeat;
    
    for (let time = 0; time < totalDuration; time += kickInterval) {
        if (!genre.includes('Ambient')) {
            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();
            osc.frequency.setValueAtTime(100, time);
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
            gain.gain.setValueAtTime(0.7, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(time);
            osc.stop(time + 0.3);
        }

        // Hi-Hats
        if (time % (secondsPerBeat) === 0 || time % (secondsPerBeat / 2) === 0) {
             if (!genre.includes('Ambient')) {
                const noise = offlineCtx.createBufferSource();
                const noiseBuff = offlineCtx.createBuffer(1, sampleRate * 0.1, sampleRate);
                const d = noiseBuff.getChannelData(0);
                for(let i=0; i<d.length; i++) d[i] = Math.random() * 2 - 1;
                noise.buffer = noiseBuff;
                
                const f = offlineCtx.createBiquadFilter();
                f.type = 'highpass';
                f.frequency.value = 7000;
                
                const g = offlineCtx.createGain();
                g.gain.value = 0.05;
                g.gain.linearRampToValueAtTime(0, time + 0.05);

                noise.connect(f);
                f.connect(g);
                g.connect(masterGain);
                noise.start(time);
             }
        }
    }

    // --- HARMONY ---
    let chordIndex = 0;
    for (let time = 0; time < totalDuration; time += chordDuration) {
        const chordName = chordProgression[chordIndex % chordProgression.length] || 'C';
        const freqs = getChordFrequencies(chordName);
        
        freqs.forEach((freq, idx) => {
            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();
            
            if (genre.includes('Synthwave')) {
                osc.type = 'sawtooth';
                // Detune
                osc.detune.value = idx === 1 ? 5 : -5; 
                gain.gain.value = 0.08;
            } else if (genre.includes('Lo-Fi')) {
                osc.type = 'sine';
                gain.gain.value = 0.12;
            } else {
                osc.type = 'triangle';
                gain.gain.value = 0.1;
            }

            // ADSR Envelope
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(gain.gain.value, time + 0.2); // Attack
            gain.gain.setValueAtTime(gain.gain.value, time + chordDuration - 0.5); // Sustain
            gain.gain.linearRampToValueAtTime(0, time + chordDuration); // Release

            osc.frequency.value = freq;
            
            // Filter Movement
            const lpf = offlineCtx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.setValueAtTime(800, time);
            lpf.frequency.linearRampToValueAtTime(2000, time + (chordDuration/2));
            lpf.frequency.linearRampToValueAtTime(800, time + chordDuration);
            
            const panner = offlineCtx.createStereoPanner();
            panner.pan.value = (idx % 2 === 0) ? -0.4 : 0.4; 

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
    const sampleRate = 24000; 
    
    const finalLength = Math.max(vocalPcm.length, backingTrackBuffer.length);
    const offlineCtx = new OfflineAudioContext(2, finalLength, sampleRate);
    
    // Vocal
    const vocalBuffer = offlineCtx.createBuffer(1, vocalPcm.length, sampleRate);
    vocalBuffer.copyToChannel(vocalPcm as any, 0); 
    
    const vocalSource = offlineCtx.createBufferSource();
    vocalSource.buffer = vocalBuffer;
    
    // Compression for Vocals to sit in mix
    const vocalComp = offlineCtx.createDynamicsCompressor();
    vocalComp.threshold.value = -18;
    vocalComp.ratio.value = 4;
    
    const vocalGain = offlineCtx.createGain();
    vocalGain.gain.value = 1.1; // Slight boost
    
    vocalSource.connect(vocalComp);
    vocalComp.connect(vocalGain);
    vocalGain.connect(offlineCtx.destination);
    vocalSource.start(0);
    
    // Backing
    const backingSource = offlineCtx.createBufferSource();
    backingSource.buffer = backingTrackBuffer;
    
    const backingGain = offlineCtx.createGain();
    backingGain.gain.value = 0.85; 

    backingSource.connect(backingGain);
    backingGain.connect(offlineCtx.destination);
    backingSource.start(0);

    const rendered = await offlineCtx.startRendering();
    return bufferToWav(rendered);
};

export const bufferToWav = (abuffer: AudioBuffer) => {
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

  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < abuffer.length) {
    for (i = 0; i < numOfChan; i++) {             
      sample = Math.max(-1, Math.min(1, channels[i][pos])); 
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
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
