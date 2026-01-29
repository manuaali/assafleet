import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's token to verify they're authenticated
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the calling user
    const {
      data: { user: callingUser },
      error: userError,
    } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !callingUser) {
      throw new Error("Unauthorized");
    }

    // Verify the calling user is a superadmin
    const { data: roleData, error: roleError } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .single();

    if (roleError || roleData?.role !== "superadmin") {
      throw new Error("Only superadmins can delete users");
    }

    // Get the user ID to delete from request body
    const { userId } = await req.json();
    if (!userId) {
      throw new Error("Missing userId in request body");
    }

    // Prevent self-deletion
    if (userId === callingUser.id) {
      throw new Error("Cannot delete yourself");
    }

    // Create admin client to delete user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // First, clear the responsible_user_id from vehicles
    await supabaseAdmin
      .from("vehicles")
      .update({ responsible_user_id: null })
      .eq("responsible_user_id", userId);

    // Delete user roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

    // Delete profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);

    // Delete the user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      userId
    );

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in delete-user function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
