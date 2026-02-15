-- Migration 019: Allow users to delete their own chat messages
-- Problem: No DELETE policy exists on chat_messages, so deletion fails with RLS violation.

DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
CREATE POLICY "Users can delete own messages"
    ON chat_messages FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );
