# SightWhale 前端与增长侧代码深度分析报告

> 分析对象：`whale-poly/whale-monorepo/services/landing`（Next.js 16 App Router + Tailwind 4 + Prisma）与 `whale-poly/whale-monorepo/apps/android`（Kotlin/Compose + Play Billing）。所有路径均为仓库相对路径。

---

## 1. 页面与路由（src/app）

| 路由 | 文件 | 作用与转化路径 |
|---|---|---|
| `/` | `src/app/page.tsx` | 营销首页：Hero + 实时鲸鱼信号预览（`LivePreview`）+ 战绩统计（`StatsSection`/`ScorePerformanceSection`/`StarWhaleSection`，来自 `components/HomeDataComponents.tsx`）+ FAQ JSON-LD。CTA：`/pricing`（主）+ `/history`（副）。`homeJsonLd.dateModified` 硬编码 `'2026-07-18'`。 |
| `/pricing` | `src/app/pricing/page.tsx` | 定价页，通过 `TRADE_INGEST_API_URL` 拉 `/stats/pricing`，卡片来自 `lib/pricing-plans.ts`。CTA → `/subscribe?plan=pro\|elite`。 |
| `/subscribe` | `src/app/subscribe/page.tsx`（client） | **核心付费漏斗**：要求用户先在 Telegram bot 生成激活码（`NEXT_PUBLIC_TELEGRAM_BOT_URL` 默认 `t.me/sightwhale_bot`），粘贴后 POST `/api/checkout` → Stripe 跳转。内置 `subscribe_view`/`activation_code_detected`/`checkout_start`/`checkout_error` 事件打点（`lib/analytics.ts`）。 |
| `/success` | `src/app/success/page.tsx` + `SuccessClient.tsx` | 支付成功确认页。 |
| `/cancel` | `src/app/cancel/page.tsx` | 取消订阅页，POST `/api/cancel`（本地降级 + 尝试 Stripe 取消）。 |
| `/history` | `src/app/history/page.tsx` | 公开可审计历史信号，`unstable_cache` 60s，从 `TRADE_INGEST_API_URL/history?limit=500` 拉取（非直连 DB）。免费用户看到"截至昨日 UTC"。 |
| `/analyze` | `src/app/analyze/page.tsx` + `error.tsx` | 单市场分析，走 `lib/analysis-engine.ts`（方向/置信度）。 |
| `/volume-analysis` | `src/app/volume-analysis/*`（`page.tsx`+`MarketCard`+`DetailDrawer`+`DivergenceChart`） | VW 量价背离分析，数据走 `/api/vw`。 |
| `/market-correlation`、`/backtesting` | 对应 page | Elite 门槛功能（`position-sizing`/`prediction`/`backtest` 也有 API）。 |
| `/polymarket-alerts-tl` | `src/app/polymarket-alerts-tl/*` | 独立 SEO 落地页（多组件：BeforeAfterTable、ConversionBlocks、PricingCompare、WhaleScoreSection、FaqRiskClosing）。 |
| `/about` `/methodology` `/terms` `/privacy` | 对应 page | 信任/合规页。 |
| `/blog` | `src/app/blog/page.tsx` | `redirect('/blog/en')`。 |
| `/blog/[language]` | `src/app/blog/[language]/page.tsx` | 博客列表，DB 驱动，ISR 3600s，从 trade_ingest `/blog/posts`+`/blog/tags` 拉取。 |
| `/blog/[language]/[slug]` | `.../[slug]/page.tsx` | 文章详情，`force-static`+ISR，`generateStaticParams` 预渲染最近 20 篇。 |
| `/site-map` | `src/app/site-map/page.tsx` | HTML 站点地图（另有无头 `sitemap.ts`）。 |
| `/demo/dataviz-landscape` | `src/app/demo/...` | 数据可视化 demo，含唯一一处 `console.log`（遗留调试）。 |
| 其他 | `opengraph-image.tsx`、`icon.svg`、`loading.tsx`、`error.tsx`、`not-found.tsx`、`globals.css`、`layout.tsx` | 全局 OG 图（静态单张）、图标、加载/错误兜底。 |

**主转化路径**：Home → Pricing → Subscribe（Telegram 激活码）→ Stripe Checkout → Success。次要路径：History/Analyze/LiveSignals 内嵌 UpgradeModal/FullAccessGating → `/subscribe?plan=pro|elite`。

---

## 2. 核心 lib（src/lib）

- **`plans.ts`**：`PLAN_LIMITS` 三层 gating（FREE: 3 alerts/天、10min 延迟、follow 1、collection 0；PRO: 无限、0 延迟、follow 20、collection 3、smart 5；ELITE: follow 100、collection `1000000`(注释"unlimited")、smart 20）。`effectivePlan()` 过期降级 FREE；`canAccessFeature()` 按 feature 枚举判断；`getLimitValue()`。
- **`pricing-plans.ts`**：营销定价卡单一来源（Pro $29/$290、Elite $59/$590），注释声明"与 Stripe 产品保持同步"。
- **`auth.ts`**：`resolveUserId()` 三级鉴权——① 网关注入头 `x-user-id`（仅当 `x-internal-secret` === `INTERNAL_GATEWAY_SECRET` 才信任）；② Telegram Mini App cookie `tg_session`（HMAC 验签）；③ 移动端 `Bearer` token。secret 单一 env，无 fallback 链（注释明确防范可伪造会话）。
- **`live-signals.ts`**：多源回退——主源直查 Postgres `whale_trades JOIN trades_raw`（`Prisma.sql` 参数化，2 小时窗口、`MIN_SIGNAL_SIZE_USD=500`，稀疏时回退无限窗口）→ 回退 whale-engine API `/whales/{wallet}` → 回退 Polymarket 公开 leaderboard。`loadLiveSignals` 用 `unstable_cache` 60s。硬编码默认 `https://whale-engine-api.onrender.com` 与 `https://sightwhale.onrender.com`。
- **`history-signals.ts`**：`$queryRawUnsafe` 连查 `alerts`/`whale_trades`/`trades_raw`/`markets`/`whale_trade_history`/`token_conditions`（全部 `$1`/`$2` 占位参数化），再批量调 Polymarket Gamma 补 ROI/结算价。文件头有"直接 DB 耦合，Python 侧改 schema 会无编译期告警"的架构警告。
- **`analysis-engine.ts`**：方向/置信度分类（`MIN_TRADE_USD=5000`、阈值 40/70、YES/NO 比率 0.2、最少 3 笔；BUY=YES、SELL=NO 的简化映射）。含 E7 逻辑：关注钱包权重 ×1.5。
- **`telegramMiniApp.ts`**：标准 Telegram WebApp initData 验证（`WebAppData` HMAC-SHA256，maxAge 可配），`signMiniAppSessionCookie`/`verifyMiniAppSessionCookie` 自签 `payloadB64.sigB64` 会话。
- **`mobileAuth.ts`**：移动端 `Bearer` 访问令牌（HMAC 自签，7 天 TTL），secret 单一 env（`MOBILE_AUTH_SECRET`）。
- **`googlePlayVerify.ts`**：用 `googleapis` 调 Play Developer API `purchases.subscriptions.get` 校验订阅；支持 env B64/JSON 服务账号。
- **`alertCooldown.ts`**：动态冷却镜像 `telegram_bot/delivery_cooldown.py` 公式（`computeEffectiveScore = score + log10(notional)*5`，分级 base 冷却 × plan 乘数）。
- **`rate-limiter.ts`**：滑动窗口内存限流器，**但全仓库仅被自己的单测引用，未接入任何 API 路由（死代码）**。
- **`blog.ts`**：博客读取主要走 HTTP（trade_ingest `/blog/*`，注释"Prisma raw SQL unreliable from Vercel"），`getRelatedPosts` 仍用 Prisma raw SQL。
- 其他：`crypto.ts`（HMAC 工具）、`use-auth.ts`（客户端 hook → `/api/me/plan`）、`analytics.ts`（Vercel Analytics 动态 import）、`external-urls.ts`（登录/注册/dashboard URL 兜底）、`prisma.ts`（全局单例 + Render 自动 `sslmode=require`）、`live-signals-access.ts`（免费用户 1 小时延迟过滤）、`market-display-filter.ts`、`polymarket-gamma.ts`、`history-roi.ts`、`markdown-utils.ts`（TOC/FAQ 抽取）、`home-content.ts`、以及 `vw-signals.ts`/`prediction-model.ts`/`position-sizing.ts`/`market-correlation.ts`/`backtesting/*` 等功能库。

---

## 3. API 路由（src/app/api）

| 路由 | 数据来源 | 鉴权/安全 |
|---|---|---|
| `subscribe/route.ts` | 代理到 payment API `/checkout` | `requireUser()` + 校验 telegram_activation_code + plan 白名单（含 `free`，可疑） |
| `checkout/route.ts` | 代理 payment API `/checkout` | `getCurrentUser()`（可选）；激活码格式校验（UUID 或 6-16 位码）；plan 别名归一（institutional→elite、basic→pro） |
| `follow/route.ts`、`follow/[wallet]/route.ts` | Prisma `whale_follows` | `requireUser()` + `canAccessFeature('whale_follow')`；事务内 count+upsert 防 TOCTOU 绕过 follow 上限 |
| `collections/*`（route、[id]、whales、whales/[wallet]、types） | Prisma | `requireUser()` + `canAccessFeature('collection_creation')`；所有权校验 `findFirst({id,userId})`；每集合最多 10 鲸鱼 |
| `smart-collections/*`（route、[id]、[id]/subscribe） | Prisma + `$queryRawUnsafe`(unnest 参数化) 关联 whale_profiles/whale_stats | `requireUser()` + `canAccessFeature('smart_collection_access')` |
| `mobile/auth/telegram`、`mobile/auth/refresh`、`mobile/me`、`mobile/whales/[wallet]`、`mobile/billing/google/sync` | Prisma + whale-engine 代理 | Telegram initData 验签；Bearer；Google Play 服务端验签（未配置时生产返回 503，开发信任客户端 expiry） |
| `tg/auth/route.ts` | Prisma | Telegram initData 验签 → 写 `tg_session` HttpOnly cookie |
| `live-signals/route.ts` | `loadLiveSignals()` | 公开，按用户 plan 过滤 1h 延迟；付费 `private` Cache-Control |
| `alerts/route.ts` | Prisma `alert_events` | GET 需用户；POST 需 `x-alert-token`（`crypto.timingSafeEqual`）——**从鲸鱼/集合反查订阅用户并去重插入，事务包裹** |
| `alerts/test/route.ts` | whale-engine `/alerts/force` | 生产 404、需登录、需 ADMIN_TOKEN |
| `vw/route.ts` | 代理 whale-engine `/vw/*` | 公开，白名单 sortBy/limit 范围 |
| `smart-money/leaderboard/route.ts` | Polymarket data-api 或本地 whale_profiles/whale_stats | 公开；`ORDER BY` 用白名单映射列名后字符串插值（安全但属代码异味） |
| `whale-waitlist/route.ts` | Prisma `whale_waitlist_leads` + 文件 fallback `data/waitlist/*.jsonl` | **未鉴权、无 rate limit**（仅校验 email 格式） |
| `blog/insert-vw/route.ts` | 代理 whale-engine `/blog/insert` | **GET 方法触发写操作、未鉴权、正文硬编码**，遗留调试/一次性脚本 |
| `home-stats-debug/route.ts` | Prisma raw SQL | 需 `x-admin-token`，调试端点 |
| `me/plan`、`cancel`、`upgrade`、`health/db` | Prisma / payment API | `upgrade` 仅 FREE 或 admin 可改，非 FREE 升级拒绝（防绕过支付） |

**安全结论**：SQL 注入基本受控（`$queryRawUnsafe` 均走 `$n` 占位或白名单映射）；鉴权覆盖较好（middleware.ts 有 Origin/CSRF 校验 + `CSRF_SKIP_PATHS`）。**主要问题**：(a) `/api/blog/insert-vw` 是 GET 触发写入的未鉴权遗留接口；(b) `/api/whale-waitlist` 公开无频控；(c) `rate-limiter.ts` 未接入；(d) `subscribe` 允许 `free` plan 进 Stripe。

---

## 4. 博客系统（两套系统的真实关系）

**真实关系 = 双轨，但只有一套上线**：

1. **DB 驱动（上线）**：`blog_posts` 表由 Python 侧管理。`services/trade_ingest/blog_generator.py`（DeepSeek V4 Pro 每日双语生成，含数据抓取→加权选题→提示词→校验→upsert，追加 AI 免责声明）；HTTP 读取由 `services/trade_ingest/api.py` 提供（`/blog/posts`、`/blog/post`、`/blog/tags`、`/blog/post` POST/DELETE、`/blog/generate`，写操作需 `x-admin-key`==BLOG_LLM_API_KEY）。landing 通过 `TRADE_INGEST_API_URL` 拉取渲染。

2. **Markdown 文件（遗留/死代码）**：`services/landing/src/content/posts/` 下有 **1042 个 .md**（含 `_rejected/` 子目录），**没有任何 App Router 代码读取它们**（grep 无 `content/posts` 引用；`gray-matter` 只在 package.json 出现）。这些是历史编辑工作区，由一次性脚本 `scripts/migrate_blog_posts.py`、`import_old_blog_posts.py`、`insert_*.py` 迁移进 `blog_posts` 表。`docs/sightwhale-system-audit-2026-07.md` 已明确指出"`content/posts/` 目录是死代码 — 写的文章不上线，除非手动通过 POST API 插入"。

**SEO 基础设施现状**（已相当完善）：
- **JSON-LD**：文章页 Article + BreadcrumbList + FAQPage（从 markdown 抽取，`markdown-utils.ts`）；列表页 ItemList + BreadcrumbList；首页 FAQPage（`dateModified` 硬编码）。
- **OG image**：仅全局静态 `opengraph-image.tsx`（1200×630，`ImageResponse`），**博客文章无独立 OG 图**（所有页面共用 `/opengraph-image`）。
- **RSS**：`blog/feed.xml/route.tsx`（EN 15 篇 + ZH 5 篇）。
- **Sitemap**：`sitemap.ts`（静态路由 + 博客动态路由，含 `alternates.languages` hreflang，`BLOG_LAUNCH` 硬编码 `2026-07-15`）。
- **robots**：`robots.ts` 显式列出 GPTBot/ClaudeBot/PerplexityBot 等 15+ AI 爬虫，disallow `/api/` `/admin/` `/login/` `/dashboard/`。
- **llms.txt**：`llms.txt/route.ts`、`llms-full.txt/route.ts`；**ai.txt**：`.well-known/ai.txt/route.ts`；**AI JSON**：`ai/summary.json`、`ai/service.json`、`ai/faq.json`。
- **hreflang**：sitemap + 文章 `generateMetadata` 的 `alternates.languages`（通过 `group_slug` 关联 EN/ZH 兄弟篇）+ `middleware.ts` 设 `x-html-lang` 头 + `/blog/:slug` → `/blog/en/:slug` 308 重定向（修复 74 处历史内链）。

**blog 相关代码文件**：`services/trade_ingest/blog_generator.py`、`services/trade_ingest/api.py`(404-622)、`services/landing/src/lib/blog.ts`、`src/lib/markdown-utils.ts`、`src/app/blog/**`（page/layout/[language]/[slug]/feed.xml/TagFilter）、`src/components/blog/**`（BlogCta/TableOfContents/ReadingProgress/BackToTop/ShareButtons/ScrollDepthTracker）、`src/components/LatestBlogPosts.tsx`、`src/app/sitemap.ts`、`src/app/llms*.txt`、`src/app/.well-known/ai.txt`、`src/app/ai/*.json`、`scripts/migrate_blog_posts.py` 等 5 个脚本。

---

## 5. Prisma schema（prisma/schema.prisma）

用户侧 13 个模型：`User`、`WhaleFollow`、`Collection`、`CollectionWhale`、`SmartCollection`、`SmartCollectionWhale`、`SmartCollectionSubscription`、`Subscription`、`AlertEvent`、`WhaleWaitlistLead`、`MarketSubscription`、`MarketVwMetrics`、`MarketVwSnapshot`；枚举 `Plan(FREE/PRO/ELITE)`，映射表名加 `@@map`，`cuid()` 主键，唯一约束如 `user_wallet_unique`、`user_smart_collection_unique`、`user_market_unique`。

**与 Python Alembic 分工**：Prisma 只管用户侧表（follows/subscriptions/collections/alert events/waitlist/vw 只读视图）；Alembic 管数据管线表（`whale_profiles`/`whale_stats`/`whale_trades`/`trades_raw`/`markets`/`alerts`/`whale_trade_history`/`token_conditions`/`blog_posts`）。**landing 同时直读两侧**——`live-signals.ts`、`history-signals.ts`、`smart-collections/[id]`、`smart-money/leaderboard`、`home-stats-debug` 用 `$queryRawUnsafe` 读 Alembic 表，形成"前端直连数据管线库"的耦合（`history-signals.ts` 头注释明确警示此风险）。

---

## 6. 安卓应用（apps/android）

- **结构**：单模块 Kotlin + Jetpack Compose（Material3）+ Retrofit/OkHttp/kotlinx-serialization + Billing 7.1.1。`MainActivity.kt` 内 4 个 Tab（Leaderboard/Signals/Whale/Subscription），全部逻辑集中在单文件（468 行，`WhaleRepository`/`WhaleApi`/data class 均 private）。
- **认证**：`MobileSession`（SharedPreferences 存 Bearer token）+ `AuthInterceptor`；登录方式为**手动粘贴 Telegram Mini App `initData`** → `POST /api/mobile/auth/telegram` → 存 token（README 明确此流程）。无 Telegram SDK、无邮箱登录。
- **Play Billing 集成状态**：`PlayBillingManager.kt` 已实现 `connect`/`launchSubscription`（SUBS 类型）/`onPurchasesUpdated`/`acknowledgeIfNeeded`；购买后构造 `GoogleBillingSyncRequest` → `POST /api/mobile/billing/google/sync`（服务端 `googlePlayVerify.ts` 验签）。**但注意**：`expiryTimeMs` 在客户端以 `purchaseTime + 30天` 估算（`MainActivity` 里未传真实到期时间，`PlayBillingManager` 里 `purchase.purchaseTime + 30L*24h`），是近似值；`app/build.gradle.kts` 的 `API_BASE_URL` **硬编码 `http://10.0.2.2:3000`**（buildConfigField，release 未覆盖）；manifest 无 Play Billing 权限声明（Billing 库不需要额外 manifest 权限）、`versionCode=1`/`versionName=0.1.0` 表明是 MVP。README 显示这是"Android MVP"。

---

## 7. 转化漏斗实现

- **`FullAccessGating.tsx`**（client）：`hasFullAccess` 为真渲染 children，否则渲染锁定卡片 + 打开 `UpgradeModal`。纯客户端 UI 门（服务端另有 gating）。
- **`UpgradeModal.tsx`**（client）：遮罩 + Esc/backdrop 关闭；**硬编码** "Upgrade to Pro — $29/mo" 与 "Go Elite — $59/mo" 两个 `<Link>` 指向 `/subscribe?plan=pro|elite`，feature 徽章可配。
- **`WhaleFollowButton.tsx`**（client）：`canFollow=false` 且未关注 → 弹 UpgradeModal（"Free 用户不能 follow"）；未关注 → 打开 `WhaleFollowSettingsModal`（配置 alert_entry/exit/add、min_size、min_score）→ `POST /api/follow`；已关注 → `DELETE /api/follow/[wallet]`。服务端 `follow/route.ts` 以 `canAccessFeature('whale_follow')` + 事务 count 兜底。
- **`LiveSignalsFeed.tsx`**（client）：SSR 首屏 + `/api/me/plan` 判定付费；付费用户 `cache:no-store` 拉全量并 **5 分钟轮询**，新信号弹 toast + 蜂鸣声（localStorage `sightwhale_signal_sound_on`）；非付费显示"延迟约 1 小时"文案 + "Get full feed"/"Unlock real-time" → `/pricing`。服务端 `/api/live-signals` 用 `filterLiveSignalsForUser` 对免费/访客过滤最近 1 小时。
- **Gating 一致性**：客户端 UI 门（FullAccessGating/UpgradeModal/WhaleFollowButton 的 `canFollow`）+ 服务端权威门（`canAccessFeature`/`filterLiveSignalsForUser`）双层，防绕过主要靠服务端。

---

## 8. 质量信号

- **硬编码 URL**（约 18 处）：`onrender.com` 默认上游（`live-signals.ts`、`vw`、`alerts/test`、`mobile/whales`、`blog/insert-vw`、`blog.ts`、`sitemap`、`feed.xml`、`llms*.txt`、`history`、`pricing`、`site-map`、`LatestBlogPosts`、`HomeDataComponents`）；`www.sightwhale.com` 硬编码于 `sitemap/robots/llms/og/ai.json` 及所有 JSON-LD；联系邮箱 `castro.liu@me.com`、`twitter.com/SightWhale` 散落多处。
- **遗留调试代码**：`api/blog/insert-vw`（GET 写操作、正文硬编码、未鉴权）；`api/home-stats-debug`（admin 调试端点）；`api/alerts/test`（生产 404）；`demo/dataviz-landscape/page.tsx` 唯一 `console.log`。
- **死代码/无头状态**：`lib/rate-limiter.ts` 未接入任何路由（仅测试引用）；`src/content/posts/` 1042 个 md 无渲染代码（死代码，靠脚本手动迁移）；`gray-matter` 依赖未使用；`blog.ts` 注释与 `getRelatedPosts` 实现自相矛盾（说 Prisma 不可靠却又用 Prisma raw SQL）。
- **定价不一致**：**四处定价源数值冲突**——`pricing-plans.ts`/`subscribe/page.tsx` Pro $29/Elite $59 vs `upgrade/route.ts` 相同 vs **`mobile/billing/google/sync` 的 `PRODUCT_PLAN_MAP` Pro $20/$200、Elite $99/$999**（Elite 月价 99 vs 59 相差 40 美元）。
- **文案不一致**：`subscribe/page.tsx` Elite 写 "Follow 100 whales · 20 collections"，而 `plans.ts` ELITE `max_collections=1000000`（unlimited）、`max_smart_collections=20`（"collections"与"smart collections"混用）；`pricing-plans.ts` Elite "80+ signals" vs subscribe "Whale Score 80+"。
- **硬编码日期**：`page.tsx` `homeJsonLd.dateModified='2026-07-18'`、`sitemap.ts` `BLOG_LAUNCH='2026-07-15'`（未来/过期风险，未动态）。
- **TODO/FIXME**：landing src 无 TODO/FIXME（相对干净）；仅 1 处 `console.log`。
- **安卓**：`API_BASE_URL` 硬编码模拟器地址（release 未覆盖）、`expiryTimeMs` 客户端 30 天近似估算、单文件 468 行 MVC 混写。

---

## 前端/增长侧从第一性原理看最重要的 5 个结构性事实

1. **付费是"Telegram 激活码 + Stripe"漏斗，但码由机器人发放、Stripe 由独立 payment 服务结算，landing 只是中转代理**——`/api/checkout` 和 `/api/subscribe` 都代理 `PAYMENT_API_BASE_URL`，真正的订阅状态由 payment 服务的 webhook 回写。前端增长侧拿不到计费闭环，订阅激活与否依赖跨服务一致性，这是最脆弱的增长链路。

2. **免费 vs 付费的"产品核心资产"（实时信号）靠时间延迟区分，而非内容区隔**——`live-signals-access.ts` 只把"最近 1 小时"藏起来，`history` 只藏"今天"，其余数据全部公开。增长杠杆本质是"实时性"这一种商品，免费层没有独立留存价值，付费意愿完全绑定在"快 1 小时"上。

3. **博客是程序化 AI 增长引擎（DB 驱动 + 每日双语自动生成 + 重度 GEO/SEO 基建），而 1042 个 Markdown 是已废弃的编辑工作区**——两套系统并存但只有 DB 上线；sitemap/RSS/llms.txt/ai.txt/hreflang 全围绕 DB 文章自动生成。这意味着内容增长已自动化，但 markdown 死目录与 `_rejected` 仍在误导维护者。

4. **前端同时直读"用户侧 Prisma 表"和"Python 管线 Alembic 表"，且靠环境变量兜底到 onrender.com 硬编码域名**——`live-signals.ts`/`history-signals.ts`/`smart-collections`/`leaderboard` 都 `$queryRawUnsafe` 跨层查询，形成 landing↔数据管线强耦合；约 18 处硬编码上游 URL 意味着多环境部署极易错配。

5. **gating 与定价没有单一事实源**——plan 限额（`plans.ts`）、营销价（`pricing-plans.ts`）、结算价（payment 服务/Stripe）、Google Play 价（`PRODUCT_PLAN_MAP`，Elite 99 vs 59）四处各自为政；客户端 UI 门 + 服务端 `canAccessFeature` 双层虽有兜底，但定价漂移会直接制造"网页显示 $59、安卓收 $99"的用户信任危机，是增长侧最需立即修复的结构性风险。
