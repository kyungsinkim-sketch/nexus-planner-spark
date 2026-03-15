-- Allow call participants to view voice recordings linked to their call rooms
CREATE POLICY "Call participants can view call recordings" ON voice_recordings
    FOR SELECT USING (
        recording_type = 'phone_call' AND
        EXISTS (
            SELECT 1 FROM call_rooms cr
            JOIN call_participants cp ON cp.room_id = cr.id
            WHERE cr.voice_recording_id = voice_recordings.id
            AND cp.user_id = (select auth.uid())
        )
    );
