import { GoogleGenAI, Type } from '@google/genai';
import type { ResearchProject } from '../src/types';

export interface CopilotStructuredResponse {
  answer: string;
  dataProvenanceNote: string;
  citations: { source: string; provenance: 'Demo Dataset' | 'Estimated' | 'Observed' | 'AI-Inferred' }[];
  recommendedNextActions: { label: string; targetTab: string; prompt: string }[];
  suggestedFollowUps: string[];
}

export async function runCopilotWithGemini(params: {
  message: string;
  mode: string;
  project?: ResearchProject;
  onboardingSummary?: string;
}): Promise<CopilotStructuredResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    throw new Error('GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to enable the AI Research Copilot.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const projectMemory = params.project
    ? {
        title: params.project.title,
        query: params.project.query,
        country: params.project.country,
        language: params.project.language,
        industry: params.project.industry,
        dataMode: params.project.dataMode,
        topSocialNetworks: params.project.intelligence.socialNetworks.slice(0, 5).map((s) => ({
          platform: s.platform,
          audiencePct: s.audiencePct,
          marketAvgPct: s.marketAvgPct,
          indexMultiplier: s.indexMultiplier,
        })),
        topKeywords: params.project.intelligence.keywords.slice(0, 5).map((k) => ({
          keyword: k.keyword,
          volume: k.searchVolume,
          kd: k.difficulty,
          intent: k.intent,
        })),
        topSubreddits: params.project.intelligence.redditCommunities.map((r) => ({
          subreddit: r.subreddit,
          complaint: r.customerComplaint,
          faq: r.faqQuestion,
        })),
        aiPlatforms: params.project.intelligence.searchAndAi.map((a) => ({
          platform: a.platform,
          visibilityScore: a.visibilityScore,
        })),
      }
    : null;

  const systemInstruction = `You are AudiencePulse AI Research Copilot, a senior marketing strategist, SEO specialist, and audience intelligence analyst.
Active Copilot Mode: ${params.mode}.
Rules:
1. Ground your recommendations strictly in the provided research project memory and user context.
2. Never fabricate live API telemetry or claim access to private follow lists or private search histories.
3. Explicitly distinguish between Demonstration Dataset numbers, Observed public signals, Estimated metrics, and AI-Inferred strategy recommendations.
4. Be concrete, actionable, and concise (use clean bullet points or numbered steps in the answer).
5. Always recommend a practical next research step across the platform tabs ('audience', 'seo', 'competitors', 'reports', 'copilot').`;

  const prompt = `User Context: ${params.onboardingSummary || 'General marketing research'}
Active Research Project Memory: ${projectMemory ? JSON.stringify(projectMemory) : 'No active project selected'}

User Request: ${params.message}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: {
            type: Type.STRING,
            description: 'Detailed, actionable marketing & SEO intelligence response grounded in project memory.',
          },
          dataProvenanceNote: {
            type: Type.STRING,
            description: 'Short transparency note distinguishing measured/demo data vs AI-inferred recommendations.',
          },
          citations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                provenance: { type: Type.STRING },
              },
            },
          },
          recommendedNextActions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                targetTab: { type: Type.STRING },
                prompt: { type: Type.STRING },
              },
            },
          },
          suggestedFollowUps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as Partial<CopilotStructuredResponse>;
  return {
    answer: parsed.answer || 'No response generated.',
    dataProvenanceNote: parsed.dataProvenanceNote || 'AI-Inferred strategy based on active project dataset.',
    citations: (parsed.citations || []).map((c) => ({
      source: String(c.source || 'Project Memory'),
      provenance:
        c.provenance === 'Observed' || c.provenance === 'Estimated' || c.provenance === 'Demo Dataset'
          ? c.provenance
          : 'AI-Inferred',
    })),
    recommendedNextActions: (parsed.recommendedNextActions || []).slice(0, 3).map((a) => ({
      label: String(a.label || 'Open Audience Module'),
      targetTab: ['audience', 'seo', 'competitors', 'reports', 'copilot'].includes(String(a.targetTab))
        ? String(a.targetTab)
        : 'audience',
      prompt: String(a.prompt || ''),
    })),
    suggestedFollowUps: (parsed.suggestedFollowUps || []).slice(0, 3),
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    throw new Error('GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to generate live AI responses.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGroundingSources(response: unknown): { title: string; url: string }[] {
  const respObj = response as {
    candidates?: {
      groundingMetadata?: {
        groundingChunks?: { web?: { uri?: string; title?: string } }[];
      };
    }[];
  };
  const chunks = respObj?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const out: { title: string; url: string }[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    let host = uri;
    try {
      host = new URL(uri).hostname.replace(/^www\./, '');
    } catch {
      host = uri;
    }
    out.push({
      title: String(chunk?.web?.title || host).slice(0, 90),
      url: uri,
    });
  }
  return out.slice(0, 10);
}

function extractMentionedBrands(text: string, sources: { title: string; url: string }[]): string[] {
  const brands = new Set<string>();
  for (const src of sources) {
    try {
      const host = new URL(src.url).hostname.replace(/^www\./, '');
      const stem = host.split('.')[0];
      if (stem && stem.length >= 2) {
        brands.add(stem.charAt(0).toUpperCase() + stem.slice(1));
      }
    } catch {
      // Ignore malformed URL
    }
  }
  const capitalizedMatches = text.match(/\b[A-Z][a-zA-Z0-9]{2,20}(?:\s+[A-Z][a-zA-Z0-9]{2,15})?\b/g) || [];
  const stopWords = new Set([
    'The', 'This', 'That', 'These', 'When', 'Where', 'What', 'Which', 'How', 'Why',
    'However', 'Also', 'Here', 'Some', 'Many', 'Best', 'Top', 'Compare', 'Average',
    'Google', 'Search', 'Overview', 'Summary', 'Price', 'Cost', 'Users', 'Check',
  ]);
  for (const cand of capitalizedMatches) {
    if (!stopWords.has(cand) && brands.size < 8) {
      brands.add(cand);
    }
  }
  return Array.from(brands).slice(0, 6);
}

export async function runKeywordAiPromptWithGemini(params: {
  promptText: string;
  keyword: string;
  language: string;
  country: string;
  state?: string;
}): Promise<{
  answer: string;
  brandsMentioned: string[];
  sources: { title: string; url: string }[];
}> {
  const ai = getGeminiClient();
  const geo = params.state && params.state !== 'All States / National'
    ? `${params.state}, ${params.country}`
    : params.country;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Answer the following search prompt accurately in ${params.language} for a user located in ${geo}. Mention relevant reputable brands, platforms, or typical local/industry benchmarks clearly and concisely (3-5 sentences).\n\nKeyword Context: ${params.keyword}\nUser Prompt: ${params.promptText}`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const answer = (response.text || '').trim();
  if (!answer) {
    throw new Error('Gemini returned an empty response for this prompt.');
  }
  const sources = extractGroundingSources(response);
  const brandsMentioned = extractMentionedBrands(answer, sources);

  return { answer, brandsMentioned, sources };
}

export async function generateKeywordAiOverviewWithGemini(params: {
  keyword: string;
  language: string;
  country: string;
  state?: string;
}): Promise<{
  aiSummary: string;
  aiOverview: string;
  brandsMentioned: { brand: string; domain: string; mentions: number; sentiment: 'Positive' | 'Neutral' | 'Mixed' }[];
  topAiSources: { rank: number; domain: string; title: string; url: string; snippet: string }[];
}> {
  const ai = getGeminiClient();
  const geo = params.state && params.state !== 'All States / National'
    ? `${params.state}, ${params.country}`
    : params.country;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Provide an authoritative, helpful AI Search Overview in ${params.language} for the search query "${params.keyword}" in ${geo}. Summarize key buyer considerations, typical pricing or criteria, and notable brands or platforms users evaluate. Keep it concise (2 short paragraphs: first a 2-sentence strategic summary, second a 3-4 sentence overview answer).`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const fullText = (response.text || '').trim();
  if (!fullText) {
    throw new Error('Gemini returned an empty AI Overview.');
  }

  const paragraphs = fullText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const aiSummary = paragraphs[0] || fullText.slice(0, 260);
  const aiOverview = paragraphs.slice(1).join('\n\n') || fullText;
  const sources = extractGroundingSources(response);
  const extractedBrands = extractMentionedBrands(fullText, sources);

  const brandsMentioned = extractedBrands.map((brand, idx) => {
    const matchedSrc = sources.find((s) => s.url.toLowerCase().includes(brand.toLowerCase().split(' ')[0]));
    let domain = `${brand.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    if (matchedSrc) {
      try {
        domain = new URL(matchedSrc.url).hostname.replace(/^www\./, '');
      } catch {
        // Keep generated domain
      }
    }
    return {
      brand,
      domain,
      mentions: Math.max(1, 5 - idx),
      sentiment: 'Positive' as const,
    };
  });

  const topAiSources = sources.map((src, idx) => {
    let domain = src.title;
    try {
      domain = new URL(src.url).hostname.replace(/^www\./, '');
    } catch {
      domain = src.title;
    }
    return {
      rank: idx + 1,
      domain,
      title: src.title,
      url: src.url,
      snippet: `Grounded Google Search citation #${idx + 1} for "${params.keyword}".`,
    };
  });

  return {
    aiSummary,
    aiOverview,
    brandsMentioned,
    topAiSources,
  };
}

