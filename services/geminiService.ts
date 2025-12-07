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
  
  const prompt = `
    Act as an expert music producer and songwriter.
    Create a detailed song concept for a track with the following parameters:
    Genre: ${params.genre}
    Mood: ${params.mood}
    Description: ${params.description}
    Vocals: ${params.hasVocals ? "Yes" : "Instrumental"}
    ${params.customLyrics ? `Use these lyrics as a base: ${params.customLyrics}` : "Write original lyrics."}

    Output a JSON object containing:
    - title (Creative song title)
    - lyrics (An array of strings, where each string is a line. If instrumental, describe the sections like '[Chorus - Exploding synths]')
    - bpm (Number, tempo)
    - instruments (Array of strings)
    - duration (Estimated duration in seconds)
    - description (Short vibe description)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
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
            description: { type: Type.STRING }
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

export const generateVocals = async (lyrics: string[], voiceName: string = 'Kore'): Promise<string> => {
    const ai = getClient();
    
    // Join lyrics into a coherent prompt, stripping out [brackets] which usually denote song structure
    const spokenText = lyrics
        .filter(line => !line.startsWith('['))
        .join(". ");

    if (!spokenText.trim()) {
        return ""; // No vocals to generate
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: spokenText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
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