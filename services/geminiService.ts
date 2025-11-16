import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language } from "../types";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateTitles = async (topic: string, language: Language): Promise<string[]> => {
  const languagePrompt = language === 'ar'
    ? "You are an expert YouTube content strategist specializing in the Middle East and North Africa (MENA) region. Generate 20 diverse, click-worthy YouTube titles in Arabic for the topic"
    : "You are an expert YouTube content strategist. Generate 20 diverse, click-worthy YouTube titles for the topic";
  
  const prompt = `${languagePrompt}: "${topic}". The titles must be under 70 characters, use proven engagement patterns (curiosity gaps, numbers, emotional triggers), and vary in style (how-tos, questions, listicles, bold statements). Ensure they are authentic to the content. Return the result as a JSON array of strings.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
      },
    },
  });

  const jsonText = response.text.trim();
  try {
    const titles = JSON.parse(jsonText);
    if (Array.isArray(titles) && titles.every(t => typeof t === 'string')) {
      return titles;
    }
    throw new Error("Invalid response format");
  } catch (e) {
    console.error("Failed to parse titles JSON:", jsonText);
    throw new Error("Could not parse the generated titles from the AI. Please try again.");
  }
};

export const generateThumbnail = async (
  title: string,
  language: Language,
  numSubjects: number,
  mainSubject1Base64: string | null,
  mainSubject2Base64: string | null,
  backgroundImages: string[],
  layout: string,
  styleDescription: string | null,
  styleStrength: number,
): Promise<string> => {
    const parts: any[] = [];

    let prompt = `**CRITICAL INSTRUCTION**: You are a professional graphic designer creating a complete YouTube thumbnail. The final output image MUST be exactly 1280x720 pixels with a 16:9 aspect ratio.\n\n`;
    prompt += `The video title is "${title}".\n\n`;

    if (language === 'ar') {
        prompt += `**Text Language**: Any text on the thumbnail must be in Arabic. Use a bold, modern, and highly readable Arabic font (like Cairo or Tajawal) suitable for headlines. Render all Arabic text correctly in RTL (right-to-left) format.\n\n`;
    } else {
        prompt += `**Text Language**: Any text on the thumbnail must be in English. Use a bold, sans-serif font that's easy to read.\n\n`;
    }

    prompt += `**Main Subjects**: You are provided with ${numSubjects} image(s) of the main subject(s). You MUST use these images in the thumbnail. **CRITICAL RULE: DO NOT alter the facial features, expression, or likeness of the people in these photos.** You may perform background removal, cropping, and place them within the composition, but the person themselves must remain unchanged.\n\n`;
    
    if (mainSubject1Base64) {
        const mimeType = mainSubject1Base64.substring(mainSubject1Base64.indexOf(":") + 1, mainSubject1Base64.indexOf(";"));
        const pureBase64 = mainSubject1Base64.substring(mainSubject1Base64.indexOf(",") + 1);
        parts.push({ inlineData: { data: pureBase64, mimeType } });
        prompt += `- Image 1 is the main subject (or subject 1).\n`;
    }
    if (mainSubject2Base64 && numSubjects === 2) {
        const mimeType = mainSubject2Base64.substring(mainSubject2Base64.indexOf(":") + 1, mainSubject2Base64.indexOf(";"));
        const pureBase64 = mainSubject2Base64.substring(mainSubject2Base64.indexOf(",") + 1);
        parts.push({ inlineData: { data: pureBase64, mimeType } });
        prompt += `- Image 2 is subject 2.\n`;
    }

    prompt += `\n**Layout**: Arrange the subject(s) according to the "${layout}" layout. `;
    if (layout === 'Versus/Comparison' && numSubjects === 2) {
        prompt += `Create a composition with the two subjects on opposing sides. `;
    } else if (layout === 'Collaboration' && numSubjects === 2) {
        prompt += `Place the two subjects side-by-side in a friendly composition. `;
    } else {
        prompt += `Place the main subject(s) prominently. `;
    }
    prompt += `The title text must be placed strategically and be highly visible.\n\n`;

    if (backgroundImages.length > 0) {
        prompt += `**Provided Background/Context Images**: You are also provided with context images. Integrate them artfully into the background design. They can be faded, blurred, or part of a collage to add depth.\n\n`;
        backgroundImages.forEach(imgBase64 => {
            const mimeType = imgBase64.substring(imgBase64.indexOf(":") + 1, imgBase64.indexOf(";"));
            const pureBase64 = imgBase64.substring(imgBase64.indexOf(",") + 1);
            parts.push({ inlineData: { data: pureBase64, mimeType } });
        });
    }
    
    if (styleDescription) {
        prompt += `**Design Style**: Adhere to the following design style with approximately ${styleStrength}% strength. This style should influence the colors, text, effects, and overall mood: \n${styleDescription}\n\n`;
    }

    prompt += `Remember, generate a polished, professional, complete thumbnail, strictly adhering to the 1280x720 resolution and the rule about not altering the main subjects' faces.`;
    
    parts.unshift({ text: prompt });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    
    const imagePart = response?.candidates?.[0]?.content?.parts?.[0];
    if (imagePart?.inlineData) {
        const base64ImageBytes: string = imagePart.inlineData.data;
        return `data:image/png;base64,${base64ImageBytes}`;
    }

    throw new Error("No thumbnail was generated by the model. The response may have been blocked due to safety settings.");
};


export const analyzeStyleReferences = async (imagesBase64: string[]): Promise<string> => {
  const imageParts = imagesBase64.map(imgBase64 => {
    const mimeType = imgBase64.substring(imgBase64.indexOf(":") + 1, imgBase64.indexOf(";"));
    const pureBase64 = imgBase64.substring(imgBase64.indexOf(",") + 1);
    return {
      inlineData: {
        data: pureBase64,
        mimeType: mimeType
      }
    };
  });

  const prompt = `You are a professional graphic designer specializing in YouTube thumbnails. Analyze the following thumbnail image(s) and extract the core style elements. Provide a concise, bulleted list covering:
- **Color Palette:** Describe the dominant and accent colors.
- **Typography:** Describe the font style (e.g., bold, sans-serif, handwritten), weight, case (e.g., all caps), and typical placement.
- **Composition:** Describe the layout (e.g., centered subject, rule of thirds, text on left).
- **Effects & Vibe:** Describe any notable effects like glows, drop shadows, borders, or background styles (e.g., gradient, noisy texture) and the overall mood (e.g., energetic, professional, mysterious).`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { text: prompt },
        ...imageParts,
      ]
    }
  });

  return response.text;
};

export const editThumbnail = async (currentThumbnailBase64: string, instruction: string, language: Language): Promise<string> => {
  const mimeType = currentThumbnailBase64.substring(currentThumbnailBase64.indexOf(":") + 1, currentThumbnailBase64.indexOf(";"));
  const pureBase64 = currentThumbnailBase64.substring(currentThumbnailBase64.indexOf(",") + 1);

  const prompt = `You are an expert image editor. Take the provided YouTube thumbnail and apply this specific user instruction: "${instruction}". 
For example, 'change the ${language === 'ar' ? 'Arabic' : 'English'} text to red' or 'make the background more vibrant'.
**IMPORTANT**: If the instruction is about the person in the thumbnail (e.g., 'make my face look more excited'), you MUST NOT alter their original facial features. Instead, add effects AROUND them (like energy lines, glows) to convey the emotion. Preserve the original likeness.
The output image must be a modified version of the original, maintaining the exact 1280x720 pixel dimensions and 16:9 aspect ratio.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: pureBase64,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ]
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  const imagePart = response?.candidates?.[0]?.content?.parts?.[0];
  if (imagePart?.inlineData) {
    const base64ImageBytes: string = imagePart.inlineData.data;
    return `data:image/png;base64,${base64ImageBytes}`;
  }

  throw new Error("No edited thumbnail was generated by the model. The response may have been blocked due to safety settings.");
};

export const getImprovementSuggestions = async (title: string, language: Language): Promise<string[]> => {
  const prompt = `You are a YouTube growth expert. Analyze the video title: "${title}". 
Provide 3 short, actionable suggestions in ${language === 'ar' ? 'Arabic' : 'English'} to improve a thumbnail for this video. 
The suggestions should be phrased as simple commands a user could give to an AI editor for editing the thumbnail. 
For example: "Add a glowing outline around the text" or "Use a brighter, more eye-catching background color". 
Return the result as a JSON array of 3 unique string suggestions.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
      },
    },
  });

  const jsonText = response.text.trim();
  try {
    const suggestions = JSON.parse(jsonText);
     if (Array.isArray(suggestions) && suggestions.every(s => typeof s === 'string')) {
      return suggestions;
    }
    throw new Error("Invalid response format for suggestions.");
  } catch (e) {
    console.error("Failed to parse suggestions JSON:", jsonText);
    throw new Error("Could not parse suggestions from the AI.");
  }
};