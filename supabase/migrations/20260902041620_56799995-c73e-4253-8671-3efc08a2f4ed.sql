-- 1. Trigger-only SECURITY DEFINER functions must not be callable via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_vehicle_assignment_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restrict_user_vehicle_updates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: signed-in users only (needed by policies), never anon
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_or_superadmin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_superadmin(uuid) TO authenticated, service_role;

-- 2. direct_messages: restrict to authenticated and validate recipient exists
DROP POLICY IF EXISTS "Users can send direct messages with role restrictions" ON public.direct_messages;
CREATE POLICY "Users can send direct messages with role restrictions"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> recipient_id
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = recipient_id)
  AND (
    public.is_admin_or_superadmin(auth.uid())
    OR public.is_admin_or_superadmin(recipient_id)
  )
);

DROP POLICY IF EXISTS "Users can view their direct messages" ON public.direct_messages;
CREATE POLICY "Users can view their direct messages"
ON public.direct_messages
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.direct_messages;
CREATE POLICY "Recipients can mark messages as read"
ON public.direct_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- 3. Realtime: allow only postgres_changes feeds (RLS-filtered), not arbitrary broadcast/presence topics
DROP POLICY IF EXISTS "Authenticated can receive realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (extension = 'postgres_changes');