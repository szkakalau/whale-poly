"""Consolidate blog_posts schema into Alembic (CR-S1).

blog_posts was previously created by runtime `CREATE TABLE IF NOT EXISTS` code
duplicated in trade_ingest/api.py, trade_ingest/worker.py, unified/app.py, and
self-migrated by blog_generator.py. This migration is the single source of
truth:

1. Create the canonical table if missing (legacy databases).
2. Add the `generation_prompt` column (previously self-migrated by blog_generator).
3. Drop the legacy `blog_posts_slug_key` unique constraint that conflicts with
   the (slug, language) uniqueness model.
4. Create the (slug, language) unique index if missing.
5. Add the query indexes the blog listing/tag pages rely on
   (sightwhale-system-audit-2026-07.md, issue #11).
"""
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS blog_posts (
            id text PRIMARY KEY,
            slug text NOT NULL,
            title text NOT NULL,
            excerpt text NOT NULL,
            content text NOT NULL,
            author text NOT NULL,
            read_time text NOT NULL,
            cover_image text,
            tags text[] DEFAULT '{}',
            published_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            language text NOT NULL DEFAULT 'en',
            group_slug text,
            status text NOT NULL DEFAULT 'published',
            generation_prompt text
        )
        """
    )
    op.execute("ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS generation_prompt text")
    op.execute("ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS blog_posts_slug_key")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_language_idx ON blog_posts (slug, language)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts (published_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_blog_posts_language_status ON blog_posts (language, status)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_blog_posts_language_status")
    op.execute("DROP INDEX IF EXISTS idx_blog_posts_status")
    op.execute("DROP INDEX IF EXISTS idx_blog_posts_published_at")
    # Keep the table and unique index (they pre-date this migration); only drop
    # what this migration added.
    op.execute("ALTER TABLE blog_posts DROP COLUMN IF EXISTS generation_prompt")
