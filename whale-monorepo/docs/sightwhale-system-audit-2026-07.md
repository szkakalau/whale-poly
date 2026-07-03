# SightWhale 全站系统质量审计报告 · 2026年7月

> **审计原则**：从第一性原理出发，不受历史决策约束。只评估事实和影响，给出可执行的改进方案。
>
> **审计范围**：代码架构 + 线上站点 + Blog SEO/GEO + 竞品格局
>
> **结论先行**：产品技术底子好（事件驱动管道、订阅计费、数据分析能力都是真优势），但**几乎所有的增长杠杆都没用上**。竞争对手在 SEO/内容领域几乎是真空，这是 SightWhale 最大的战略窗口。

---

## 一、总体评分卡

| 维度 | 评分 | 一句话 |
|------|------|--------|
| **产品核心技术** | ⭐⭐⭐⭐⭐ | 事件驱动管道 + 钱包聚类 + 校准 ROI 评分 — 真正有壁垒 |
| **代码架构** | ⭐⭐⭐ | 整体清晰但 14 个待修复问题积压，SQL 注入、竞态条件、静默失败 |
| **首页转化设计** | ⭐⭐⭐⭐ | 信任叙事好、数据驱动、CTA 合理，但缺少免费入口 |
| **Blog 内容质量** | ⭐⭐⭐⭐ | 技术深度文章极好，但被大量模板化 SEO 水文稀释 |
| **Blog SEO 基础设施** | ⭐⭐ | Meta 标签有但缺 JSON-LD、缺图片、缺内链、缺分享 |
| **Blog GEO (AI 搜索)** | ⭐⭐ | llms.txt 存在但陈旧、无结构化数据、FAQ 无 Schema 标记 |
| **技术 SEO** | ⭐⭐⭐⭐ | robots.txt 完美、sitemap 完整、hreflang 正确、RSS 存在 |
| **竞品内容护城河** | ⭐ | Bullpen 有 128 篇文章，我们 144 篇但质量参差 |
| **整体竞争力** | ⭐⭐⭐ | 产品 > 营销。修好 SEO/GEO + 内容策略 = 可成为第一 |

---

## 二、🔴 严重问题（立即修复，影响最大）

### 1. 全站 0 个 JSON-LD 结构化数据

**现状**：博客文章页面的 `generateMetadata` 里写了 `openGraph.type: 'article'` 和 `publishedTime`，但实际的 `<script type="application/ld+json">` **只在 blog post 页面存在且仅包含 Article + BreadcrumbList**。首页、定价页、历史页 — **全部没有 JSON-LD**。

**影响**：
- Google 不展示富摘要（FAQ、面包屑、评分星级）
- AI 引擎（ChatGPT、Perplexity）无法精确提取结构化信息
- 这是 SEO 101 级别的问题，修复成本极低但收益极高

**修复**：
```
首页 → Organization + WebSite schema
定价页 → Product + Offer schema（带价格、货币、功能列表）
FAQ区块 → FAQPage schema（每个问答对标记 Question/Answer）
博客列表 → ItemList schema
博客文章 → 已有 Article + BreadcrumbList，需补充 FAQPage（当文章含FAQ时）
```

### 2. llms.txt / llms-full.txt 严重过时

**现状**：`/llms-full.txt` 只列了6个页面，**完全没有 blog 文章索引**。产品描述只有一句话 "anonymized whale-style signals"。没有任何定价信息、FAQ、数据来源说明。

**影响**：
- AI 爬虫（GPTBot、ClaudeBot）抓取 llms.txt 来理解站点结构，但我们现在给 AI 的信息只是一张空白地图
- 当用户在 ChatGPT/Perplexity 里问 "best polymarket whale tracker"，AI 找不到我们的详细内容
- 这是 GEO 优化最基础的要素 — 我们连地基都没打

**修复**：
```markdown
# llms-full.txt 应包含：
1. 完整产品描述（功能、定价层级、技术架构简述）
2. 所有公开页面列表（含 blog）
3. 最新 20 篇博文标题 + 摘要 + URL
4. FAQ（从首页和定价页提取）
5. 联系方式
6. 最后更新时间戳
```

### 3. Blog 文章零图片、零分享按钮、零相关文章

**现状**：144 篇文章，没有一篇有 `cover_image`。文章页面没有任何社交分享按钮。底部没有 "Related Posts" 推荐。

**影响**：
- 社交分享体验为 0 — 读者即使喜欢文章也无法一键分享
- Open Graph image 用的是通用 `/opengraph-image`，所有文章同一张图 — 毫无差异化
- 没有相关文章推荐 → 跳出率 100%，用户读完就走，PV/会话 = 1
- 图片 SEO 流量为 0（Google Image Search）

**修复**（按优先级）：
1. 每篇文章自动生成独特的 OG 图片（标题 + 日期 + 品牌，用 `ImageResponse` 动态渲染）
2. 添加底部 "Related Posts"（已在代码中有 `getRelatedPosts` 函数但未在页面中使用）
3. 添加社交分享按钮行（Twitter/X、LinkedIn、复制链接）
4. 定期为重点文章手选/生成 cover image

### 4. 博客内容策略：两个独立系统造成的混乱

**现状**：存在**两套平行的博客系统**：
- **系统A**：`content/posts/` 目录下的 135 个 Markdown 文件（手动管理）
- **系统B**：`blog_generator.py` 每日自动生成 → 写入 PostgreSQL → 通过 API 服务于前端

**问题**：
- 系统A 的文件**永远不会出现在线上**（前端渲染从数据库读，不走本地文件）
- 系统B 的文章质量波动大（DeepSeek 自动生成，最低 1000 字门槛极低）
- 两套系统的内容没有统一的编辑审核流程
- `content/posts/` 目录是死代码 — 写的文章不上线，除非手动通过 POST API 插入

**修复**：
- **立即**：确认 `content/posts/` 目录的定位 — 是编辑工作区还是已废弃？
- **短期**：统一为单一真源（数据库），本地文件只作为编辑草案
- **中期**：建立编辑审核 pipeline — 生成 → 人工审核 → 发布，而非自动发布

---

## 三、🟡 高优先级问题（2周内修复）

### 5. Blog 元数据：有框架但内容弱

**实际质量抽查**：
- ✅ `generateMetadata` 在 blog 页面存在且工作正常
- ✅ hreflang 正确设置
- ✅ canonical URL 正确
- ❌ **meta description 经常缺失或不优化** — 大多数文章直接用 `excerpt` 字段，很多超过 160 字符
- ❌ **所有页面共用同一个 OG image** (`/opengraph-image`) — 文章获取不到独特的社交分享卡片
- ❌ **Twitter card 未设置 `@site` handle**

**修复**：
1. 为博客文章 `generateMetadata` 添加动态 OG image URL（`/og/blog/[slug]?title=...`）
2. 截断/优化 `excerpt` 到 150-160 字符用于 meta description
3. 添加 Twitter `creator` / `site` handle

### 6. RSS Feed 不可发现

**现状**：RSS feed 存在于 `/blog/feed.xml`，但**全站 HTML head 中没有 `<link rel="alternate" type="application/rss+xml">` 标签**。

**影响**：RSS 阅读器、播客平台、Feedly 等无法自动发现 — 等于没有 RSS。

**修复**：在 root layout 或 blog layout 的 metadata 中添加 RSS discovery link。

### 7. 首页 "Live Signals" Loading 状态

**现状**：首页动态加载实时信号，但网络失败或 API 慢时显示 "Loading..."。

**修复**：添加静态 fallback（缓存最近信号）、error boundary、skeleton loading。

### 8. 定价页 H1 不是关键词驱动

**现状**：定价页 H1 = "Pay only if it makes sense"（品牌化文案），不含 "Pricing"、 "Polymarket"、 "Whale Tracking" 等关键词。

**影响**：搜索引擎无法理解这个页面的主题。

**修复**：改为 `"SightWhale Pricing — Polymarket Whale Tracking Plans"` 或品牌 + 关键词的组合。

### 9. SQL 注入风险（blog API）

**现状**：`api.py` 中 `/blog/posts` 和 `/blog/tags` 端点使用 **f-string 拼接 SQL**：
```python
f"where status = 'published' and language = '{language}' {tag_where}"
```

`language` 参数直接拼接，虽然目前调用方只传 `en`/`zh`，但这是一个定时炸弹。

**修复**：改为参数化查询 `sa.bindparam()` 或 Prisma 参数化。

---

## 四、🟢 中优先级（1个月内）

### 10. 内容质量分层：精华被稀释

**现状（量化）**：
- **A 级文章**（~25 篇）：技术深度分析 — wallet clustering 101、signal half-life、liquidity regimes、VW analysis。**原创框架、学术引用、可复现代码。**
- **B 级文章**（~40 篇）：策略教程 + 事件分析 — 有用但不够深。
- **C 级文章**（~50 篇）：SEO 模板文（"are there tools to..."、"how to find..."） — 高度重复，关键词堆砌。

**策略**：
- A 级文章是真正的护城河内容 — 应优先在首页、邮件、社交渠道推广
- C 级文章应回顾并提升质量，或合并为更全面的指南
- 每个内容集群应有 1 篇 pillar content（3000+ 字综合指南）+ N 篇 cluster content

### 11. blog_posts 表缺少关键索引

**现状**：
- ❌ 无 `published_at` 索引（列表排序依赖）
- ❌ 无 `status` 索引（每次查询过滤）
- ❌ 无 `tags` GIN 索引（标签聚合查询用 `unnest(tags)` ）
- ❌ 无全文搜索能力（无 `tsvector` 列）

**修复**：
```sql
CREATE INDEX idx_blog_posts_published_at ON blog_posts (published_at DESC);
CREATE INDEX idx_blog_posts_status ON blog_posts (status);
CREATE INDEX idx_blog_posts_tags ON blog_posts USING GIN (tags);
CREATE INDEX idx_blog_posts_language_status ON blog_posts (language, status);
```

### 12. 博客缺少搜索功能

**现状**：博客只有标签过滤，没有关键词搜索。144 篇文章没有搜索 → 发现性极差。

**修复**：
- Phase 1：客户端搜索（加载所有文章标题+摘要到前端，简单 filter）
- Phase 2：PostgreSQL 全文搜索（`tsvector` + `tsquery`）

### 13. 作者 E-E-A-T 信号弱

**现状**：作者署名 "SightWhale" 或 "Whale Team"，没有真人名字、Bio、LinkedIn、Twitter。Google E-E-A-T 指南明确要求内容展示 Expertise、Experience、Authoritativeness、Trustworthiness。

**修复**：
- 为主要作者创建 Bio 页面（真人或品牌化人设）
- 每篇文章底部添加作者卡片（头像 + Bio + 社交链接）
- 如果团队有知名成员，优先展示

### 14. 事件类文章缺乏"结果追踪"

**现状**：~20 篇事件预测类文章（如 "government shutdown 2026"、"NYC snowfall Jan 24-26"）在事件结束后没有更新结果。

**影响**：这些文章看起来像"预测了但不敢公布结果" — 损害信任。Google 也会对过时的事件页面降低排名。

**修复**：
- 回顾最近 20 篇事件类文章，在顶部添加 "Outcome: ✅ Correct / ❌ Wrong / ⏳ Pending" 标注
- 为未来的事件文章预设"回访日期"触发器

---

## 五、🔵 竞争力突破点（游戏规则改变者）

### 15. Browser Extension — 最高意图捕捉渠道

**现状**：PolySmart（$20/月）、PolyWhale（免费）都在 Chrome Web Store 上有用户。它们直接在 Polymarket 页面上显示鲸鱼评分。

**机会**：SightWhale 有更好的评分算法（校准 ROI + 钱包聚类 + 市场上下文）。做一个比 PolySmart 更好的免费扩展，直接在 Polymarket 上显示 SightWhale Whale Score。免费扩展 → Telegram 推送 → 付费转化。

**投入**：~2 周开发（一个 Manifest V3 扩展 + SightWhale API 集成）

**预期 ROI**：极高。这是直接捕获正在 Polymarket 上交易的高意图用户的最短路径。

### 16. 可嵌入式 Whale Score Badge（内容营销武器）

**现状**：没有品牌化的评分方法。HashDive 有 "Smart Score"（-100 到 100），我们应该有更透明的东西。

**方案**：发布 "SightWhale Whale Confidence Index" — 公开评分公式 + 回测数据 + API 访问。成为一个行业标准指标。

**内容策略**：
- 1 篇方法论白皮书（锚定页面，持续获取外链）
- 每周/月发布 "Whale Confidence Top 10" 排行榜
- 让第三方博客/媒体可以嵌入我们的评分

### 17. 内容集群重组（Pillar + Cluster）

当前 144 篇文章是平的。应该重组为：

```
Pillar 1: Polymarket Whale Tracking Complete Guide (已有 ← 刚发布的)
  ├── Wallet Clustering 101
  ├── Signal Half-Life Framework
  ├── How to Evaluate Whale Tracking Tools (5-Point Checklist)
  └── Whale Trading Misconceptions

Pillar 2: Polymarket Trading Strategy
  ├── Directional vs Hedging
  ├── Liquidity Regimes Detection
  ├── Volume-Weighted Price Analysis
  └── Position Building Patterns

Pillar 3: Polymarket Market Analysis
  ├── How to Read Market Mechanics
  ├── Bull/Bear Case Framework
  ├── Event-Driven Trading
  └── Risk Management

Pillar 4: SightWhale Platform
  ├── How Whale Score Works
  ├── Smart Collections Methodology
  ├── Alert Calibration Guide
  └── Case Studies (real wallet track records)
```

---

## 六、🔧 现有的 14 个待修复问题（与上述交叉引用）

现有 plan 文件中的 14 个问题与本报告关系：

| 计划问题 | 本报告对应 | 优先级判断 |
|----------|-----------|-----------|
| A1 (VW SQL 注入) | #9 — 同级严重度 | ✅ 应修复 |
| A2 (rate_limit 竞态) | 独立问题 | ✅ 应修复 |
| A3 (blog_generator DDL + backoff) | #4 相关 | ✅ 应修复但需配合策略调整 |
| B1 (Docker 非 root) | 独立安全加固 | ✅ 应修复 |
| B2 (Docker postgres 命名卷) | 独立基础设施 | ✅ 应修复 |
| C1 (迁移竞态) | 独立运维问题 | ✅ 应修复 |
| C2 (无关 envVars) | 独立清理 | ✅ 应修复 |
| C3 (硬编码 URL) | 独立清理 | ⚠️ 低优先级 |
| D1-D4 (冷却+消息重构) | 独立业务逻辑 | ✅ 应修复但需要更深入测试 |

---

## 七、执行路线图

### 第 0 周（立即 — 今天/明天）
**目标**：修复最大 ROI 的 SEO 基础设施漏洞

| # | 行动 | 影响 | 工作量 |
|---|------|------|--------|
| 1 | 全站添加 JSON-LD 结构化数据（Organization, Article, FAQPage, BreadcrumbList, Product） | 搜索结果富摘要 + AI 引擎可发现 | 1天 |
| 2 | 重写 llms.txt + llms-full.txt，包含 blog 索引 | AI 引擎可发现全部内容 | 2小时 |
| 3 | 修复 RSS discovery link（在 HTML head 中） | RSS 阅读器/聚合器可发现 | 10分钟 |
| 4 | 定价页 H1 改为关键词驱动 | 搜索引擎理解页面主题 | 5分钟 |

### 第 1 周
**目标**：Blog 用户体验 + 内容基础

| # | 行动 | 影响 | 工作量 |
|---|------|------|--------|
| 5 | 每篇博客文章生成独特 OG 图片 | 社交分享差异化 | 1天 |
| 6 | 添加社交分享按钮 | 社交传播 | 半天 |
| 7 | 启用 Related Posts（代码已存在） | PV/会话提升 | 1小时 |
| 8 | 添加 blog 搜索功能（客户端 MVP） | 内容可发现性 | 半天 |
| 9 | 添加数据库索引（published_at, status, tags） | API 性能 | 1小时 |

### 第 2 周
**目标**：内容质量提升

| # | 行动 | 影响 | 工作量 |
|---|------|------|--------|
| 10 | 审阅 C 级文章，合并/提升/删除 | 整站内容质量 | 2天 |
| 11 | 为 20 篇事件文章添加 "Outcome" 标注 | 信任+时效性 | 半天 |
| 12 | 为 3 个 Pillar 主题创建 Cluster 内链 | 内容集群 SEO | 1天 |
| 13 | 添加作者 Bio + E-E-A-T 信号 | Google 排名因子 | 半天 |

### 第 3-4 周
**目标**：竞争力突破

| # | 行动 | 影响 | 工作量 |
|---|------|------|--------|
| 14 | 修复 14 个待处理代码问题（批次 A+B） | 代码质量+安全 | 3天 |
| 15 | 设计 + 发布 "Whale Confidence Index" 方法论页 | 品牌 IP | 2天 |
| 16 | 规划 Chrome Extension MVP | 最高意图渠道 | 1天设计 |

### 第 2 个月
**目标**：护城河建设

| # | 行动 |
|---|------|
| 17 | 开发 + 发布 Chrome Extension |
| 18 | 内容集群重组完成（4 Pillars × N Clusters） |
| 19 | 博客自动化审核管线（生成 → 审核 → 发布） |
| 20 | PostgreSQL 全文搜索上线 |

---

## 八、一句话摘要

> SightWhale 的产品技术在所有 Polymarket 鲸鱼追踪竞品中是最有壁垒的（事件管道 + 钱包聚类 + 校准评分），但在 SEO/GEO/内容营销三个增长杠杆上的投入几乎为零。好消息是：**所有竞品在这些维度上也是零。** 谁先建好内容护城河 + AI 搜索优化 + 浏览器扩展分发，谁就是第一。修复本报告中的严重+高优先级问题只需约 2 周，回报是整站 SEO 流量从几乎为零到主导 "polymarket whale tracking" SERP。
