import { useEffect, useState } from 'react';
import { Bot, Download, Plus, Send, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import type { CopilotConversation, ResearchProject } from '../types';

const COPILOT_MODES = [
  'Research Planner',
  'Opportunity Finder',
  'Buyer Intent Detector',
  'Content Strategy Generator',
  'Research Report Explainer',
];

const SUGGESTED_PROMPTS = [
  'Find my ideal customers and highest-leverage social platforms',
  'Discover profitable low-competition search terms from our dataset',
  'Research customer pain points in Reddit communities',
  'Build a 30-day marketing plan combining YouTube, LinkedIn, and SEO',
  'How can we win more brand citations in Gemini, ChatGPT, and Perplexity?',
];

interface CopilotWorkspaceProps {
  projects: ResearchProject[];
  activeProject?: ResearchProject;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
  onNavigateTab: (tab: 'overview' | 'audience' | 'seo' | 'competitors' | 'copilot' | 'reports' | 'settings' | 'admin') => void;
  onCreditsUpdated?: () => void;
}

export function CopilotWorkspace({
  projects,
  activeProject,
  initialPrompt,
  onClearInitialPrompt,
  onNavigateTab,
  onCreditsUpdated,
}: CopilotWorkspaceProps) {
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProject?.id || projects[0]?.id || '');
  const [mode, setMode] = useState<string>(COPILOT_MODES[0]);
  const [input, setInput] = useState(initialPrompt || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.getConversations();
        setConversations(res.conversations);
        if (res.conversations[0]) {
          setActiveConvId(res.conversations[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load conversations');
      }
    })();
  }, []);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      onClearInitialPrompt?.();
    }
  }, [initialPrompt, onClearInitialPrompt]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  const sendMessage = async (textToSend?: string) => {
    const prompt = (textToSend ?? input).trim();
    if (!prompt || sending) return;
    setError(null);
    setSending(true);
    if (!textToSend) setInput('');

    try {
      const res = await api.sendCopilotMessage({
        conversationId: activeConvId,
        projectId: selectedProjectId || activeProject?.id,
        message: prompt,
        mode,
      });
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === res.conversation.id);
        if (exists) {
          return prev.map((c) => (c.id === res.conversation.id ? res.conversation : c));
        }
        return [res.conversation, ...prev];
      });
      setActiveConvId(res.conversation.id);
      onCreditsUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI Research Copilot failed to respond');
    } finally {
      setSending(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!activeConv) return;
    const text = activeConv.messages
      .map((m) => `### ${m.role === 'user' ? 'You' : 'AudiencePulse AI Copilot'} (${m.mode || 'General'})\n${m.content}\n`)
      .join('\n---\n\n');
    const blob = new Blob([`# ${activeConv.title}\n\n${text}`], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeConv.title.replace(/\W+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left History & Project Memory Sidebar */}
      <aside className="lg:col-span-4 space-y-4">
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-bold">Research Conversations</h2>
            <button
              type="button"
              onClick={() => setActiveConvId(undefined)}
              className="px-2.5 py-1 rounded-lg bg-[#565FEA] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors truncate cursor-pointer ${
                  conv.id === activeConvId
                    ? 'bg-[#565FEA]/10 text-[#565FEA] dark:text-[#8E96FF] font-semibold'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {conv.title}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <label htmlFor="copilot-project-memory" className="block text-xs font-semibold">
            Project Memory Context
          </label>
          <select
            id="copilot-project-memory"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <label htmlFor="copilot-mode-select" className="block text-xs font-semibold pt-1">
            Copilot Specialist Mode
          </label>
          <select
            id="copilot-mode-select"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs"
          >
            {COPILOT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="pt-2 space-y-1.5">
            <p className="text-xs font-semibold text-slate-500">Suggested Prompts</p>
            {SUGGESTED_PROMPTS.map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setInput(sp)}
                className="w-full text-left p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs hover:border-[#565FEA] transition-colors cursor-pointer"
              >
                {sp}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Chat Canvas */}
      <div className="lg:col-span-8 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col min-h-[620px]">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-[#565FEA]" />
            <div>
              <h1 className="text-base font-display font-bold">AI Research Copilot</h1>
              <p className="text-xs text-slate-500">
                Mode: {mode} · Connected to project memory
              </p>
            </div>
          </div>
          {activeConv && (
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Notes
            </button>
          )}
        </div>

        <div className="flex-1 p-6 space-y-5 overflow-y-auto max-h-[520px]">
          {!activeConv || activeConv.messages.length === 0 ? (
            <div className="py-12 text-center space-y-3 max-w-md mx-auto">
              <Sparkles className="w-8 h-8 text-[#565FEA] mx-auto" />
              <h2 className="text-base font-display font-bold">Ask anything about your audience, keywords, or rivals</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every response cites whether insights come from the active demonstration dataset, observed public signals,
                or AI-inferred strategy.
              </p>
            </div>
          ) : (
            activeConv.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#565FEA] text-white'
                      : 'bg-slate-100 dark:bg-[#0D1021] text-[#171B35] dark:text-slate-100 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {msg.citations.map((c, i) => (
                      <span key={i}>
                        Source: {c.source} ({c.provenance})
                      </span>
                    ))}
                  </div>
                )}

                {msg.recommendedNextActions && msg.recommendedNextActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.recommendedNextActions.map((act) => (
                      <button
                        key={act.label}
                        type="button"
                        onClick={() => {
                          if (act.prompt) {
                            void sendMessage(act.prompt);
                          } else {
                            onNavigateTab(act.targetTab as 'audience' | 'seo' | 'competitors' | 'reports');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#FFE500]/90 text-[#171B35] text-xs font-semibold hover:bg-[#FFE500] cursor-pointer"
                      >
                        Next: {act.label}
                      </button>
                    ))}
                  </div>
                )}

                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.suggestedFollowUps.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void sendMessage(q)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-[#565FEA] cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {sending && <div className="text-xs text-slate-500">Analyzing research project memory...</div>}
        </div>

        {error && (
          <div className="mx-6 mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2.5"
        >
          <label htmlFor="copilot-input" className="sr-only">
            Ask AI Research Copilot
          </label>
          <input
            id="copilot-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask: Build a 30-day marketing plan or find low-KD opportunities..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#565FEA] text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#464ED8] disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
