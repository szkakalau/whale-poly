
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from shared.models.models import TokenCondition
from services.trade_ingest.markets import resolve_token_id
from sqlalchemy import select

@pytest.mark.asyncio
async def test_resolve_token_id_with_hint(db_session: AsyncSession):
    # Test resolving with a title hint (Layer 1.5)
    token_id = "test_token_hint"
    hint = "Test Market Question"
    
    question = await resolve_token_id(db_session, token_id, title_hint=hint)
    assert question == hint
    
    # Verify it was cached
    cached = (await db_session.execute(select(TokenCondition).where(TokenCondition.token_id == token_id))).scalars().first()
    assert cached is not None
    assert cached.question == hint

@pytest.mark.asyncio
async def test_resolve_token_id_caching(db_session: AsyncSession):
    # Test that it uses the cache
    token_id = "test_token_cache"
    question_text = "Cached Question"
    
    # Manually insert into cache
    new_cache = TokenCondition(
        token_id=token_id,
        condition_id="cond_123",
        market_id="market_123",
        question=question_text
    )
    db_session.add(new_cache)
    await db_session.commit()
    
    # Resolve and check if it matches cache
    resolved = await resolve_token_id(db_session, token_id)
    assert resolved == question_text
