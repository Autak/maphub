import { GoogleGenAI } from "@google/genai";

// Safe access to process.env for browser environments
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.API_KEY;
  }
  return '';
};

const apiKey = getApiKey();

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateFunCaption = async (imageFile: File, userContext?: string): Promise<string> => {
  if (!apiKey) {
    console.warn("No API Key provided for Gemini");
    return "Looks like an amazing spot! (API Key missing for AI caption)";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const imageBase64 = await fileToGenerativePart(imageFile);

    const prompt = userContext 
      ? `Look at this photo from a trip. The user says: "${userContext}". Write a very brief, fun, witty, or adventurous 1-sentence comment about this location and moment. Keep it under 20 words. Emoji encouraged.`
      : `Look at this terrain/outdoor photo. Write a very brief, fun, witty, or adventurous 1-sentence caption for a map pin. Keep it under 20 words. Emoji encouraged.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: imageFile.type,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "Found a cool new place!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An epic location for the books! (AI error)";
  }
};
