// js/gemini-api.js - Google Gemini Generative AI Client for Sweet Smile Pastry
import { store } from './store.js';

export class GeminiAPI {
  static candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
  ];

  static _customApiKey = null;

  /**
   * Resolves the active Gemini API key in prioritized order:
   * 1. In-memory custom key (set via GeminiAPI.setApiKey)
   * 2. Global window.GEMINI_API_KEY
   * 3. store.getSettings()?.geminiApiKey
   * 4. localStorage "sweet_smile_gemini_key"
   * @returns {string|null}
   */
  static getApiKey() {
    if (this._customApiKey && typeof this._customApiKey === "string" && this._customApiKey.trim()) {
      return this._customApiKey.trim();
    }

    if (typeof window !== "undefined" && window.GEMINI_API_KEY && typeof window.GEMINI_API_KEY === "string") {
      const k = window.GEMINI_API_KEY.trim();
      if (k) return k;
    }

    try {
      const settings = typeof store !== "undefined" && store.getSettings ? store.getSettings() : null;
      if (settings && settings.geminiApiKey && typeof settings.geminiApiKey === "string" && settings.geminiApiKey.trim()) {
        return settings.geminiApiKey.trim();
      }
    } catch (_) {}

    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("sweet_smile_gemini_key");
        if (stored && typeof stored === "string" && stored.trim()) {
          return stored.trim();
        }
      }
    } catch (_) {}

    return null;
  }

  /**
   * Updates and persists the Gemini API key.
   * @param {string} key 
   */
  static setApiKey(key) {
    const cleanKey = (key || "").trim();
    this._customApiKey = cleanKey || null;

    try {
      if (typeof store !== "undefined" && store.updateSettings) {
        store.updateSettings({ geminiApiKey: cleanKey });
      }
    } catch (_) {}

    try {
      if (typeof localStorage !== "undefined") {
        if (cleanKey) {
          localStorage.setItem("sweet_smile_gemini_key", cleanKey);
        } else {
          localStorage.removeItem("sweet_smile_gemini_key");
        }
      }
    } catch (_) {}

    return cleanKey;
  }

  /**
   * Checks whether a valid Gemini API key is configured.
   * @returns {boolean}
   */
  static hasApiKey() {
    return Boolean(this.getApiKey());
  }

  /**
   * Executes a generateContent call against Gemini API with automatic model cascade fallback.
   * @param {Object} options
   * @param {Array} options.contents - Gemini contents array
   * @param {string} [options.systemInstruction] - System prompt string
   * @param {Object} [options.generationConfig] - Generation configuration (e.g. responseMimeType)
   * @param {string} [options.modelOverride] - Specific model name to target first
   * @returns {Promise<{text: string, raw: Object, modelUsed: string}>}
   */
  static async generateContent({ contents, systemInstruction = null, generationConfig = null, modelOverride = null }) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("Clave de Google Gemini no configurada. Ingrese su API key en Configuración.");
    }

    const modelsToTry = modelOverride
      ? [modelOverride, ...this.candidateModels.filter(m => m !== modelOverride)]
      : [...this.candidateModels];

    let lastError = null;

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const payload = { contents };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      if (generationConfig) {
        payload.generationConfig = generationConfig;
      }

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          let errorBody = "";
          try {
            const errJson = await response.json();
            errorBody = errJson?.error?.message || JSON.stringify(errJson);
          } catch (_) {
            errorBody = await response.text().catch(() => "");
          }
          console.warn(`[GeminiAPI] Model ${model} responded with status ${response.status}: ${errorBody}`);
          lastError = new Error(`Error en modelo ${model} (${response.status}): ${errorBody || "Sin respuesta del servidor"}`);
          continue; // Try next model in cascade
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const text = candidate?.content?.parts?.map(p => p.text || "").join("") || "";

        return {
          text,
          raw: data,
          modelUsed: model
        };
      } catch (err) {
        console.warn(`[GeminiAPI] Error querying model ${model}:`, err.message || err);
        lastError = err;
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Sin conexión a internet. La aplicación continuará funcionando en modo offline.");
    }

    throw new Error(
      lastError?.message ||
      "No se pudo obtener respuesta de ningún modelo de Google Gemini. Verifique su API Key o cuota de servicio."
    );
  }

  /**
   * Helper for conversational chat with Chef IA.
   * @param {string} userMessage - Latest user question
   * @param {string} [systemPrompt] - System prompt instructions and pantry context
   * @param {Array<{sender: string, text: string}>} [history] - Previous chat messages
   * @returns {Promise<string>} - Assistant's response in markdown/plain text
   */
  static async chat(userMessage, systemPrompt = null, history = []) {
    const contents = [];

    // Map history to Gemini contents format
    for (const item of history) {
      if (!item || !item.text) continue;
      contents.push({
        role: item.sender === "assistant" || item.sender === "model" ? "model" : "user",
        parts: [{ text: item.text }]
      });
    }

    // Add current user prompt
    contents.push({
      role: "user",
      parts: [{ text: userMessage }]
    });

    const result = await this.generateContent({
      contents,
      systemInstruction: systemPrompt
    });

    return result.text;
  }

  /**
   * Helper for multimodal vision and structured JSON recipe extraction.
   * @param {Object} options
   * @param {string} options.prompt - Text instructions
   * @param {string} [options.imageBase64] - Base64 image data (with or without data URI scheme)
   * @param {string} [options.mimeType] - Image MIME type (e.g. image/jpeg, image/png)
   * @param {string} [options.systemPrompt] - System prompt
   * @returns {Promise<Object>} - Parsed JavaScript JSON object
   */
  static async generateStructuredJson({ prompt, imageBase64 = null, mimeType = "image/jpeg", systemPrompt = null }) {
    const parts = [];

    if (imageBase64 && typeof imageBase64 === "string" && imageBase64.trim()) {
      let cleanBase64 = imageBase64.trim();
      let detectedMime = mimeType || "image/jpeg";

      if (cleanBase64.startsWith("data:")) {
        const commaIdx = cleanBase64.indexOf(",");
        if (commaIdx !== -1) {
          const header = cleanBase64.substring(0, commaIdx);
          cleanBase64 = cleanBase64.substring(commaIdx + 1);
          const mimeMatch = header.match(/data:([^;]+)/);
          if (mimeMatch) detectedMime = mimeMatch[1];
        }
      }

      parts.push({
        inlineData: {
          mimeType: detectedMime,
          data: cleanBase64
        }
      });
    }

    if (prompt) {
      parts.push({ text: prompt });
    }

    const result = await this.generateContent({
      contents: [{ role: "user", parts }],
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    return this.cleanAndParseJson(result.text);
  }

  /**
   * Cleans code markdown blocks and extracts the valid JSON payload.
   * @param {string} raw 
   * @returns {Object}
   */
  static cleanAndParseJson(raw) {
    if (!raw || typeof raw !== "string") {
      throw new Error("Respuesta vacía recibida de la API de IA.");
    }

    let str = raw.trim();

    // Strip markdown code fences
    if (str.startsWith("```json")) {
      str = str.substring(7);
    } else if (str.startsWith("```")) {
      str = str.substring(3);
    }

    if (str.endsWith("```")) {
      str = str.substring(0, str.length - 3);
    }

    str = str.trim();

    // Isolate outer JSON boundaries
    const firstBrace = str.indexOf("{");
    const firstBracket = str.indexOf("[");
    let startIdx = -1;

    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    const lastBrace = str.lastIndexOf("}");
    const lastBracket = str.lastIndexOf("]");
    const endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      str = str.substring(startIdx, endIdx + 1);
    }

    try {
      return JSON.parse(str);
    } catch (err) {
      console.error("[GeminiAPI] JSON parse error on payload:", str, err);
      throw new Error("No se pudo interpretar el formato JSON devuelto por la IA.");
    }
  }
}
