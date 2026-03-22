# NeuroPace 🎯
### AI-Powered Adaptive Study Companion
**GDG UTSC AI Case Competition 2026 — Build with AI, Powered by Google**

---

## The Problem

The standard way of studying — walls of text, long readings, passive review — is built for one type of learner. But many university students don't fit that mould:

- **International students** process content in a second language, doubling cognitive load
- **Students with ADHD** struggle to sustain focus through long unbroken material  
- **Students with dyslexia or autism** process text differently, requiring more time and repetition

The result: slower reading, repeated reprocessing, heightened stress — and over time, disengagement and burnout.

## The Solution

NeuroPace takes any academic content and transforms it into **gamified, sequenced study missions** using Gemini AI.

- Paste any notes, textbook excerpt, or lecture transcript
- Gemini breaks it into focused 5-minute missions with natural concept boundaries
- Each mission has a comprehension quiz — answer correctly to unlock the next
- Earn XP as you progress

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JS |
| AI | Google Gemini 2.0 Flash API |
| Deployment | Static — runs in any browser |

## How to Run

1. Clone this repo
2. Open `index.html` in your browser
3. Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com)
4. Paste your key into the app
5. Paste your notes and hit **Generate Missions**

No installation, no backend, no dependencies.

## Project Structure

```
neuropace/
├── index.html   ← App structure
├── style.css    ← All styling
├── app.js       ← Logic + Gemini API call
└── README.md
```

## Why Gemini

This project uses Gemini 2.0 Flash for its speed, structured output reliability, and generous free tier — making it accessible to students worldwide without a credit card.

---

*Built by a solo international student with ADHD, for students like me.*
