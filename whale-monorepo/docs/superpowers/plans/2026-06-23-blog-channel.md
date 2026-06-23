# Blog Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully automated, bilingual (EN/ZH) blog channel for SightWhale — LLM-generated daily articles, database-driven, ISR-rendered, with complete SEO coverage.

**Architecture:** Celery Beat triggers `generate_daily_article` daily at 20:00 BJT → calls DeepSeek API to generate EN+ZH articles from real on-chain data → inserts into `blog_posts` table → Next.js `/blog` pages render via ISR with `prose` markdown styling.

**Tech Stack:** Python 3 (Celery, SQLAlchemy, httpx, openai SDK), Next.js 16 (App Router, ISR, react-markdown, remark-gfm, Tailwind prose), PostgreSQL (raw SQL)

## Global Constraints

- LLM: DeepSeek V4 Pro via `https://api.deepseek.com/v1` / model `deepseek-chat`
- Articles: 1500-2500 words per language, markdown format
- Languages: `en` and `zh` — Chinese is localized adaptation, NOT direct translation
- Schedule: Daily at 20:00 Beijing time (crontab(hour=20, minute=0))
- ISR: Detail pages 86400s, listing pages 3600s
- Content quality gate: ≥1500 words, ≥3 data points, no banned AI phrases
- Blog base URL: `https://www.sightwhale.com/blog`
- Slug format: `{language}/{slug}` — e.g. `/blog/en/whale-strategy-101`

---
