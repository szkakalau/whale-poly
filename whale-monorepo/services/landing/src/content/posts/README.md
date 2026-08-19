# content/posts — 离线编辑工作区（不是渲染源）

这个目录是博客文章的**离线编辑工作区**。App Router **不会**从这里渲染任何内容——
线上博客由 Postgres 的 `blog_posts` 表驱动（Python 侧 `services/trade_ingest/api.py`
提供 HTTP 读取，Next.js 在 `src/app/blog/**` 消费）。

## 工作流

1. 在此目录撰写/修订 Markdown 文章（EN 与 ZH 各自一个文件）。
2. 用仓库根目录的脚本把文章导入 `blog_posts` 表：
   - `python scripts/insert_blog_post.py <file.md>`
   - 或 `python scripts/migrate_blog_posts.py`（批量）
3. 发布/状态变更走 blog 管理 API（需要 `x-admin-key`）。

## 注意

- **不要**把这里的文件当作“上线”状态——只有数据库里的才是线上内容。
- 每日自动生成的文章由 `services/trade_ingest/blog_generator.py` 直接写库，
  不经过本目录。
- 本目录不参与 `next build` 打包（无代码引用）。
