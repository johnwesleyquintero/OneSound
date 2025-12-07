import { GoogleGenAI, Type, Modality } from "@google/genai";
import { GenerationParams, Song } from "../types";

// Helper to ensure API key is present
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please set process.env.API_KEY.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSongConcept = async (params: GenerationParams): Promise<Partial<Song>> => {
  const ai = getClient();
  
  const duetInstruction = params.isDuet 
    ? `Format the lyrics as a duet between two people. Prefix every line with either "Speaker 1:" or "Speaker 2:". Create a dynamic interaction.` 
    : "Output standard lyrics.";

  const prompt = `
    Act as an expert music producer and composer.
    Create a detailed song concept for a track with the following parameters:
    Genre: ${params.genre}
    Mood: ${params.mood}
    Description: ${params.description}
    Vocals: ${params.hasVocals ? "Yes" : "Instrumental"}
    ${duetInstruction}
    ${params.customLyrics ? `Use these lyrics as a base: ${params.customLyrics}` : "Write original lyrics."}

    STRICT JSON OUTPUT REQUIRED.
    Output a JSON object containing:
    - title (String. Max 6 words. Creative, evocative, and concise. Do NOT include parentheses, descriptions, alternative titles, or commentary. JUST the title.)
    - lyrics (An array of strings, where each string is a line. If instrumental, describe the sections like '[Chorus - Exploding synths]'. Max 50 lines total. Do NOT loop or repeat infinitely.)
    - bpm (Number, tempo between 60-160)
    - instruments (Array of strings)
    - duration (Estimated duration in seconds)
    - description (Short vibe description, max 2 sentences)
    - musicalElements (Object):
        - key (e.g., "C", "F#", "Am")
        - scale (e.g., "Major", "Minor", "Dorian")
        - chordProgression (Array of strings representing chords for a 4-bar loop, e.g., ["Am", "F", "C", "G"])
  `;

  try {
    // We use gemini-2.5-flash with thinkingConfig to ensure the music theory (chords/key) 
    // is reasoned out logically before generating the JSON.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 4096, 
        thinkingConfig: { thinkingBudget: 1024 }, // Allocating budget for musical reasoning
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            lyrics: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            bpm: { type: Type.INTEGER },
            instruments: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            duration: { type: Type.INTEGER },
            description: { type: Type.STRING },
            musicalElements: {
                type: Type.OBJECT,
                properties: {
                    key: { type: Type.STRING },
                    scale: { type: Type.STRING },
                    chordProgression: { 
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
          }
        }
      }
    });

    let text = response.text;
    if (!text) throw new Error("No text response from Gemini");
    
    // Clean potential markdown fences
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    
    return JSON.parse(text) as Partial<Song>;
  } catch (error) {
    console.error("Gemini Song Concept Error:", error);
    throw error;
  }
};

export const refineLyrics = async (currentLyrics: string[], instruction: string): Promise<string[]> => {
    const ai = getClient();
    
    const prompt = `
      Act as a world-class lyricist. 
      Refine the following lyrics based on this instruction: "${instruction}".
      
      Rules:
      1. Keep the same general structure/length.
      2. Improve rhyme scheme and flow.
      3. Return ONLY the JSON array of strings.
      
      Current Lyrics:
      ${JSON.stringify(currentLyrics)}
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          maxOutputTokens: 4096,
          // Thinking budget helps here for rhyming complexity
          thinkingConfig: { thinkingBudget: 512 }, 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lyrics: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              }
            }
          }
        }
      });
  
      let text = response.text;
      if (!text) throw new Error("No text response");
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const data = JSON.parse(text);
      return data.lyrics;
    } catch (error) {
      console.error("Lyric Refinement Error:", error);
      return currentLyrics; // Fallback to original
    }
  };

export const generateCoverArt = async (song: Partial<Song>): Promise<string> => {
  const ai = getClient();
  
  const prompt = `
    Album cover art for a song titled "${song.title}".
    Genre: ${song.genre}.
    Mood: ${song.mood}.
    Vibe description: ${song.description}.
    High quality, artistic, 4k, trending on artstation.
    Minimal text.
  `;

  try {
    // Using generateContent with gemini-3-pro-image-preview for high quality images
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data returned");
  } catch (error) {
    console.error("Gemini Cover Art Error:", error);
    // Return placeholder on error to not break the flow
    return "https://picsum.photos/400/400?grayscale";
  }
};

export const generateVocals = async (lyrics: string[], voiceName: string = 'Kore', secondaryVoiceName?: string): Promise<string> => {
    const ai = getClient();
    
    // Join lyrics
    const spokenText = lyrics
        .filter(line => !line.startsWith('['))
        .join("\n");

    if (!spokenText.trim()) {
        return ""; // No vocals to generate
    }

    try {
        let speechConfig = {};

        if (secondaryVoiceName) {
            // Multi-speaker config
            speechConfig = {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        {
                            speaker: 'Speaker 1',
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
                        },
                        {
                            speaker: 'Speaker 2',
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: secondaryVoiceName } }
                        }
                    ]
                }
            };
        } else {
            // Single speaker config
            speechConfig = {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            };
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: spokenText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: speechConfig,
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data returned");
        }

        return base64Audio; 

    } catch (error) {
        console.error("Gemini Vocal Generation Error:", error);
        throw error;
    }
}

export interface AudioAnalysis {
  genre: string;
  bpm: number;
  sonicCharacteristics: string;
  suggestedPreset: string;
  reasoning: string;
}

export const analyzeAudioTrack = async (audioBase64: string): Promise<AudioAnalysis> => {
  const ai = getClient();

  const prompt = `
    You are an expert Audio Mastering Engineer. 
    Analyze the provided audio snippet.
    Identify the genre and estimate the BPM.
    Analyze the sonic characteristics (e.g., muddy, bright, quiet, distorted).
    
    Based on the analysis, recommend the BEST mastering preset from this exact list:
    - "Modern Clarity (AI Clean)"
    - "Vintage Tape Saturation"
    - "Warm Tube Amp"
    - "Bass Boosted & Punchy"
    - "Vocal Isolation"

    Provide a short technical reasoning for your choice.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: audioBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            genre: { type: Type.STRING },
            bpm: { type: Type.INTEGER },
            sonicCharacteristics: { type: Type.STRING },
            suggestedPreset: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No analysis returned");
    
    return JSON.parse(text) as AudioAnalysis;
  } catch (error) {
    console.error("Gemini Audio Analysis Error:", error);
    // Fallback default
    return {
      genre: "Unknown",
      bpm: 120,
      sonicCharacteristics: "Standard audio",
      suggestedPreset: "Modern Clarity (AI Clean)",
      reasoning: "Analysis failed, defaulting to clean preset."
    };
  }
};

export const generateMusicVideo = async (song: Song): Promise<string> => {
    // 1. API Key Check for Veo
    if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
             try {
                const success = await (window as any).aistudio.openSelectKey();
                if (!success) throw new Error("API Key selection cancelled.");
             } catch (e) {
                 throw new Error("Please select a paid API key to use Veo video generation.");
             }
        }
    }

    // 2. Re-initialize client to pick up potentially new key
    const ai = getClient();
    
    const prompt = `
        Cinematic music video scene for a song titled "${song.title}".
        Genre: ${song.genre}.
        Visual Vibe: ${song.description}.
        Atmosphere: ${song.mood}.
        High quality, 4k, photorealistic, trending on artstation, cinematic lighting, slow motion.
        No text.
    `;

    console.log("Generating video with prompt:", prompt);

    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
            operation = await ai.operations.getVideosOperation({operation: operation});
            console.log("Video generation status:", operation.metadata);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) throw new Error("No video URI returned.");

        // Fetch the bytes (requires key)
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
        
        const blob = await response.blob();
        return URL.createObjectURL(blob);

    } catch (error) {
        console.error("Veo Video Generation Error:", error);
        throw error;
    }
};