# NeuroNest 🧠
### AI-Powered Adaptive Learning Companion
**GDG UTSC AI Case Competition 2026 — Build with AI, Powered by Google**

---

## The Problem

The standard way of studying — walls of text, long readings, passive review — is built for one type of learner. But many university students don't fit that mould:

- **International students** process content in a second language, doubling cognitive load
- **Students with ADHD** struggle to sustain focus through long unbroken material
- **Students with dyslexia or autism** process text differently, requiring more time and repetition

The result: slower reading, repeated reprocessing, heightened stress — and over time, disengagement and burnout.

## The Solution

NeuroNest takes any academic content and transforms it into your ideal learning format using Gemini AI. Choose how your brain learns best:

- 🎧 **Audio** — converts notes into a podcast-style script you can listen to anywhere
- 🃏 **Simplified & Flashcards** — plain-language rewrite, step-by-step explanations, or downloadable flashcard sheets
- 🎯 **Quiz & Feedback** — 3 progressive levels, pass to advance, fail and get targeted revision feedback

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JS |
| AI | Google Gemini 2.0 Flash API |
| Deployment | Static — runs in any browser, no backend |

## How to Run

1. Clone this repo
2. Copy `config.example.js` → rename to `config.js`
3. Add your Gemini API key inside `config.js`
4. Open `index.html` in your browser

Get a free Gemini key at [aistudio.google.com](https://aistudio.google.com) — no credit card required.

No installation, no backend, no dependencies.

## Project Structure
```
neuropace/
├── index.html          ← All screens and UI
├── style.css           ← Crystal blue dark theme
├── app.js              ← All logic + Gemini API calls
├── config.example.js   ← API key template (copy to config.js)
└── README.md
```

## Why Gemini

Gemini 2.0 Flash is fast, reliable at structured JSON output, and has a generous free tier — making NeuroNest accessible to students worldwide without a credit card.

---

*Built solo by an international student with ADHD, for students like me.*