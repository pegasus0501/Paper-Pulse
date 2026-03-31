# PaperPulse 🔬

Discover research papers the internet is actually talking about.

PaperPulse is an AI-powered research discovery tool that finds the most discussed and viral academic papers matching your interests — and shows you exactly why the ML community is buzzing about them, with real reactions from Reddit, Hacker News, and Twitter/X.

---

## What it does

Type any research topic — RAG, LLM agents, diffusion models, anything — and PaperPulse will:

1. Search ArXiv for the most relevant recent papers
2. Scan Reddit, Hacker News, and Twitter/X for community discussions
3. Rank papers by semantic match + web buzz score
4. Return 2–4 papers with a rich community thread for each — key findings, debates, criticisms, hot takes, and why it matters

---

## Demo

> "Find me the most discussed papers on RAG and AI agents right now"

PaperPulse returns papers like **GraphRAG**, **CRAG**, and **SWE-agent** — each with a 15-point community thread showing exactly what researchers and practitioners are saying about them online.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | Core framework, routing, SSR, API routes |
| React 19 | UI components, hooks (useState, useRef, useCallback) |
| TypeScript | Type safety — Paper, ParsedResult, UploadedFile interfaces |
| Tailwind CSS v4 | Utility-first styling, custom animations in globals.css |
| Framer Motion | Card entrance animations, expand/collapse, loading states |
| shadcn/ui + Base UI | Accessible pre-built components (Badge, etc.) |
| Lucide React | Icons (Search, Upload, Zap, Flame, and more) |

### Backend
| Technology | Purpose |
|---|---|
| Next.js API Route | Secure proxy at /api/search — API key never touches the browser |

### AI / Workflow
| Technology | Purpose |
|---|---|
| Dify | Agentic workflow platform — orchestrates the full research pipeline |
| Gemini Flash Lite | LLM powering reasoning and synthesis inside Dify |
| ArXiv Tool (Dify) | Searches ArXiv for recent papers matching user topics |
| Web Search Tool (Dify) | Scans Reddit, HN, Twitter/X for community buzz signals |

### Dev & Deploy
| Technology | Purpose |
|---|---|
| GitHub | Version control and code hosting |
| .env.local | Keeps API keys off GitHub (gitignored) |
| .env.example | Documents required environment variables |

---

## Architecture
```
User types topics
      ↓
React UI (Next.js frontend)
      ↓
POST /api/search  ← API key stays here, never exposed to browser
      ↓
Dify Workflow
  ├── ArXiv Tool → finds recent papers
  ├── Web Search Tool → finds Reddit/HN/Twitter discussions
  ├── Gemini Flash Lite → ranks by semantic match + buzz score
  └── Formats structured paper output
      ↓  (~40 seconds)
JSON response with structured paper data
      ↓
Parser splits raw text into Paper objects
      ↓
Framer Motion cards render beautifully
```

---

## The Dify Agent Workflow

The core intelligence of PaperPulse lives in a Dify agentic workflow with the following design:

### Inputs
| Variable | Type | Description |
|---|---|---|
| `query` | Text | User's topic prompt |
| `uploads` | File (optional) | Reference paper PDF for semantic matching |
| `current_date` | Text | Today's date — auto-filled via sys.date |

### Agent Process
1. **Topic extraction** — Parses user prompt into 2–3 core topics
2. **ArXiv search** — Finds recent papers (last 12 months preferred)
3. **Web search** — Scans Reddit, HN, Twitter for community discussions
4. **Semantic ranking** — Scores each paper: `(Semantic Match × 0.6) + (Web Buzz × 0.4)`
5. **Thread generation** — Writes 15-point community thread per paper
6. **Validation** — Confirms every paper has a real link and web discussion source

### Output Format
Each paper card contains:
- Title, authors, date, ArXiv link
- Relevance Score + Web Buzz Score (both out of 10)
- Discussion sources (Reddit, HN, Twitter)
- "Why people are talking about this" hook
- 15-point community thread with findings, debates, criticisms, hot takes

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Dify account (cloud or self-hosted)
- Dify Workflow API key

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/paperpulse.git
cd paperpulse
```

**2. Install dependencies**
```bash
npm install
```

**3. Set up environment variables**
```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:
```
DIFY_API_KEY=your_dify_workflow_api_key
DIFY_API_URL=https://api.dify.ai/v1
```

**4. Run the development server**
```bash
npm run dev
```

Open `http://localhost:3000` and start discovering papers.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DIFY_API_KEY` | Yes | Your Dify workflow API key |
| `DIFY_API_URL` | Yes | Dify API base URL |

Never commit `.env.local` to GitHub — it is gitignored by default.

---

## Setting Up the Dify Workflow

If you want to run your own Dify backend:

1. Create a new **Agent** workflow in Dify
2. Add these tools: **ArXiv Search** + **Tavily Search** (or Serper)
3. Set model to **Gemini Flash Lite** (or any capable LLM)
4. Set **Max Iterations** to 10, **Max Tokens** to 4096
5. Set **Agent Strategy** to **Function Calling**
6. Paste the system instructions from `dify/instructions.md` into the Instructions field
7. Set up the Query field with variables: `query`, `uploads`, `current_date`
8. Connect the End node to the agent's text output
9. Copy the workflow API key into your `.env.local`

---

## Example Prompts
```
Find me the most discussed papers on RAG and retrieval 
augmented generation right now
```
```
What are the most viral AI agents and tool use papers 
being debated on Reddit and Twitter?
```
```
Show me the hottest papers on LLM reasoning and chain 
of thought from the last 6 months
```
```
Find papers on diffusion models and image generation 
that the ML community is excited about
```

---

## How Ranking Works

PaperPulse scores every candidate paper on two dimensions:

**Semantic Match (0–5)**
How closely the paper matches the user's stated topics and any uploaded reference paper.

**Web Buzz (0–5)**
How actively the paper is being discussed right now — based on Reddit threads, HN posts, Twitter mentions, and blog coverage found during search.

**Combined Score = (Semantic Match × 0.6) + (Web Buzz × 0.4)**

Only papers with verified web discussion evidence are included — a semantically perfect paper with zero online discussion will never appear.

---

## Project Structure
```
paperpulse/
├── app/
│   ├── page.tsx              # Home page — search input
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Custom animations
│   └── api/
│       └── search/
│           └── route.ts      # Dify proxy API route
├── components/
│   ├── SearchBar.tsx         # Topic input + file upload
│   ├── PaperCard.tsx         # Individual paper result card
│   ├── LoadingState.tsx      # Animated loading ticker
│   └── CoveragesSummary.tsx  # Search coverage footer
├── lib/
│   ├── parser.ts             # Parses raw Dify output into Paper objects
│   └── types.ts              # TypeScript interfaces
├── dify/
│   └── instructions.md       # Full Dify agent instructions
├── .env.example              # Environment variable template
└── README.md
```

---

## Contributing

Pull requests are welcome. For major changes please open an issue first to discuss what you would like to change.

---

## License

MIT

---

## Acknowledgements

- [Dify](https://dify.ai) — the agentic workflow platform powering the backend
- [ArXiv](https://arxiv.org) — open access research paper repository
- [Tavily](https://tavily.com) — AI-native web search API
- [Framer Motion](https://www.framer.com/motion) — animation library
- [shadcn/ui](https://ui.shadcn.com) — accessible UI components

---

Built with curiosity. For researchers, engineers, and anyone who wants to know what the ML community is actually excited about.
