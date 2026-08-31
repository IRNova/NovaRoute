"use client";

import PropTypes from "prop-types";

const CLI_GUIDES = {
  claude: {
    install: "npm install -g @anthropic-ai/claude-code",
    login: "claude login",
    note: "After logging in through the CLI, import the session via the Claude import flow.",
    docs: "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview",
  },
  codex: {
    install: "npm install -g @openai/codex",
    login: "codex login",
    note: "Codex uses an OAuth session tied to the installed CLI.",
    docs: "https://github.com/openai/codex",
  },
  cursor: {
    install: "Download Cursor from cursor.com and sign in.",
    login: "Open Cursor → Settings → Account",
    note: "Cursor authentication is extracted from the local IDE session.",
    docs: "https://cursor.com",
  },
  kiro: {
    install: "Install the Kiro / AWS CodeWhisperer desktop CLI or VS Code extension.",
    login: "kiro login",
    note: "Kiro uses Builder ID or IAM Identity Center.",
    docs: "https://kiro.dev",
  },
  cline: {
    install: "Install the Cline VS Code extension from the marketplace.",
    login: "Open Cline panel → Sign in",
    note: "Cline authenticates via the IDE extension.",
    docs: "https://cline.bot",
  },
  opencode: {
    install: "npm install -g opencode-ai\n# or: curl -fsSL https://opencode.ai/install | bash",
    login: "opencode",
    note: "OpenCode Free is a local CLI that does not require an API key.",
    docs: "https://opencode.ai",
  },
  commandcode: {
    install: "npm install -g @commandcode/cli",
    login: "commandcode login",
    note: "Command Code requires a valid API key from the CommandCode dashboard.",
    docs: "https://commandcode.dev",
  },
  "devin-cli": {
    install: "Install the Devin CLI from Cognition Labs.",
    login: "devin login",
    note: "Devin CLI uses ACP stdio transport and authenticates through the Devin platform.",
    docs: "https://devin.ai",
  },
  "devin-cli-agentic": {
    install: "Install the Devin Agentic CLI from Cognition Labs.",
    login: "devin login",
    note: "Devin Agentic Bridge supports Claude Opus 4.7 and GPT-5.5 via the Devin platform.",
    docs: "https://devin.ai",
  },
  "devin-desktop": {
    install: "Install Devin Desktop from devin.ai.",
    login: "Open Devin Desktop → Sign in with your Devin account",
    note: "Devin Desktop uses OAuth. Complete login in the desktop app, then connect here.",
    docs: "https://devin.ai",
  },
  kilocode: {
    install: "Install the Kilocode CLI extension for VS Code.",
    login: "kilocode login",
    note: "Kilocode authenticates through the extension.",
    docs: "https://kilocode.ai",
  },
  "grok-cli": {
    install: "Install the Grok CLI from xAI.",
    login: "grok login",
    note: "Grok CLI authenticates via xAI OAuth.",
    docs: "https://x.ai",
  },
  "kimi-coding": {
    install: "Install the Kimi Coding CLI.",
    login: "kimi login",
    note: "Kimi uses OAuth via Moonshot.",
    docs: "https://kimi.ai",
  },
  xai: {
    install: "Install the xAI CLI from xAI.",
    login: "xai login",
    note: "xAI uses OAuth. Complete the login flow in the terminal.",
    docs: "https://x.ai",
  },
  iflow: {
    install: "Install the iFlow CLI.",
    login: "iflow login",
    note: "iFlow uses OAuth. Complete login in the CLI first.",
    docs: "https://iflow.cn",
  },
  "gemini-cli": {
    install: "npm install -g @google/gemini-cli",
    login: "gemini",
    note: "Gemini CLI authenticates via Google OAuth. Free Google account gives access to Gemini models. Deprecated — prefer Gemini API key.",
    docs: "https://github.com/google-gemini/gemini-cli",
  },
  antigravity: {
    install: "npm install -g @anthropic-ai/claude-code\n# Or install Antigravity IDE:\n# Download from antigravity.google",
    login: "antigravity login",
    note: "Antigravity authenticates via Google OAuth (same as Gemini CLI). Free access to Gemini models.",
    docs: "https://antigravity.google",
  },
  "ollama-local": {
    install: "Install Ollama locally:\ncurl -fsSL https://ollama.com/install.sh | sh",
    login: "ollama serve",
    note: "Ollama Local runs on your machine at http://localhost:11434. No API key needed.\nPull models: ollama pull <model-name>",
    docs: "https://ollama.com",
  },
  ollama: {
    install: "Get your API key from:\nhttps://ollama.com/settings/keys",
    login: "No login needed — just add the API key in the dashboard.",
    note: "Ollama Cloud requires a paid API key. For free local usage, use Ollama Local instead.",
    docs: "https://ollama.com",
  },
  "lmstudio-local": {
    install: "Download LM Studio from lmstudio.ai and install.",
    login: "Open LM Studio → Download a model → Start the local server",
    note: "LM Studio runs locally at http://localhost:1234. No API key needed.\nDownload models from the LM Studio browser.",
    docs: "https://lmstudio.ai",
  },
  "lm-studio-local": {
    install: "Download LM Studio from lmstudio.ai and install.",
    login: "Open LM Studio → Download a model → Start the local server",
    note: "LM Studio runs locally at http://localhost:1234. No API key needed.",
    docs: "https://lmstudio.ai",
  },
  "llamacpp-local": {
    install: "Build llama.cpp from source:\ngit clone https://github.com/ggerganov/llama.cpp\ncd llama.cpp && make -j\n\nOr install via package manager:\nbrew install llama.cpp",
    login: "./llama-server -m /path/to/model.gguf",
    note: "llama.cpp runs locally at http://localhost:8080. No API key needed.\nDownload .gguf models from Hugging Face.",
    docs: "https://github.com/ggerganov/llama.cpp",
  },
};

const DEFAULT_GUIDE = {
  install: "Install the provider's official CLI or IDE extension.",
  login: "Follow the provider's authentication instructions.",
  note: "Complete the setup in your terminal or IDE, then return here to connect.",
  docs: null,
};

export default function CliSetupPanel({ providerId, providerName, onContinue }) {
  const guide = CLI_GUIDES[providerId] || DEFAULT_GUIDE;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-primary text-2xl">terminal</span>
        <div>
          <h3 className="font-semibold text-lg">{providerName} — CLI Setup</h3>
          <p className="text-sm text-text-muted">Follow these steps to connect {providerName}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Step number={1} title="Install the CLI">
          <CodeBlock>{guide.install}</CodeBlock>
        </Step>

        <Step number={2} title="Authenticate">
          <CodeBlock>{guide.login}</CodeBlock>
        </Step>

        {guide.note && (
          <div className="flex gap-2 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
            <span className="material-symbols-outlined text-base shrink-0">info</span>
            <span>{guide.note}</span>
          </div>
        )}

        {guide.docs && (
          <a
            href={guide.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Documentation
          </a>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onContinue}
          className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          I've installed it — Connect
        </button>
      </div>
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm mb-1">{title}</p>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="bg-muted rounded-lg px-4 py-2 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

CliSetupPanel.propTypes = {
  providerId: PropTypes.string.isRequired,
  providerName: PropTypes.string.isRequired,
  onContinue: PropTypes.func.isRequired,
};
