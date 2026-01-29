-- Create table for group chat messages (visible to all users)
CREATE TABLE public.group_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for private/direct messages
CREATE TABLE public.direct_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    content TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Group messages: All authenticated users can view
CREATE POLICY "All users can view group messages"
ON public.group_messages FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Group messages: All authenticated users can insert their own messages
CREATE POLICY "Users can send group messages"
ON public.group_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Direct messages: Users can view messages they sent or received
CREATE POLICY "Users can view their direct messages"
ON public.direct_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Direct messages: Regular users can only message admins/superadmins
-- Admins/superadmins can message anyone
CREATE POLICY "Users can send direct messages with role restrictions"
ON public.direct_messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id 
    AND (
        -- Admins and superadmins can message anyone
        is_admin_or_superadmin(auth.uid())
        OR
        -- Regular users can only message admins/superadmins
        is_admin_or_superadmin(recipient_id)
    )
);

-- Direct messages: Users can update read_at for messages they received
CREATE POLICY "Recipients can mark messages as read"
ON public.direct_messages FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;