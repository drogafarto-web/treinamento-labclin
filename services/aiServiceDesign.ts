
import { GoogleGenAI, Type } from "@google/genai";
import { AIQuizRequest, AIEffectivenessRequest } from '../types';

// O segredo do processo é a consistência regulatória (RDC 978)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Gera um Quiz técnico a partir do texto de um POP.
 * Conforme Art. 128: Avaliação de conhecimento técnico.
 */
export const generateQuizQuestions = async (request: AIQuizRequest, content: string) => {
  const prompt = `
    Você é um Especialista em Educação Laboratorial e Garantia da Qualidade.
    Crie um quiz técnico de nível ${request.difficulty} para validar o conhecimento sobre este POP.
    Foque em segurança do paciente, critérios de rejeição e valores críticos.
    
    Texto do POP:
    """
    ${content}
    """
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswerIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING }
          },
          required: ["question", "options", "correctAnswerIndex", "explanation"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

/**
 * Gera um Plano de Aula (Lesson Outline) baseado em tema e RDC.
 */
export const generateLessonOutline = async (topic: string, popText: string, rdcReference: string) => {
  const prompt = `
    Crie um plano de aula técnico para o tema: ${topic}.
    Referência normativa: ${rdcReference}.
    Use o POP abaixo como base técnica.
    
    POP:
    """
    ${popText}
    """
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
          key_points: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                topic: { type: Type.STRING }, 
                description: { type: Type.STRING } 
              } 
            } 
          },
          duration_minutes: { type: Type.INTEGER }
        },
        required: ["title", "objectives", "key_points", "duration_minutes"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

/**
 * Analisa eficácia do treinamento cruzando dados quantitativos e qualitativos.
 */
export const summarizeTrainingEffectiveness = async (data: AIEffectivenessRequest, moduleTitle: string) => {
  const prompt = `
    Analise os dados de eficácia do treinamento "${moduleTitle}".
    Dados: Erro Antes: ${data.errorRateBefore}%, Erro Depois: ${data.errorRateAfter}%, Não Conformidades: ${data.nonConformities}.
    Feedback: "${data.feedback}"
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          trends: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["summary", "trends", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};
