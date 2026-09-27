-- These failed extraction claims were produced by the former split validator.
-- They have no committed journal interpretation, and retaining them can pin an
-- offline retry to obsolete extraction metadata. Clear only that known failure
-- class so the original immutable capture can be claimed and parsed again.
delete from finn_private.ai_operations
where task = 'entry_extraction'
  and status = 'failed'
  and validation_code = 'ungrounded_equal_split';
