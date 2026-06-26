import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is authenticated and is a super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (!user || userError) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Super admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { garageId, contact } = await req.json();

    if (!garageId || !contact?.email || !contact?.password) {
      return new Response(JSON.stringify({ error: "garageId, contact.email, and contact.password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the garage's organization_id
    const { data: garage, error: garageError } = await supabase
      .from("garages")
      .select("id, name, organization_id")
      .eq("id", garageId)
      .maybeSingle();

    if (garageError || !garage) {
      return new Response(JSON.stringify({ error: "Garage not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garage must have an organization_id to link users to it
    if (!garage.organization_id) {
      return new Response(JSON.stringify({ error: "This garage does not have an organisation linked. Save the garage first, then add portal users." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = garage.organization_id;
    const email = contact.email.trim().toLowerCase();

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u) => u.email === email);

    let authUserId: string;

    if (existingUser) {
      // Update password
      const { error: updateErr } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: contact.password,
      });
      if (updateErr) throw new Error(`Failed to update password: ${updateErr.message}`);
      authUserId = existingUser.id;
    } else {
      // Create new auth user
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: contact.password,
        email_confirm: true,
        user_metadata: {
          name: contact.name,
          surname: contact.surname,
          organization_id: orgId,
        },
      });
      if (createErr || !newUser.user) throw new Error(`Failed to create user: ${createErr?.message}`);
      authUserId = newUser.user.id;
    }

    // Upsert profile with garage_user role
    await supabase.from("profiles").upsert({
      id: authUserId,
      role: "garage_user",
      name: contact.name,
      surname: contact.surname,
      organization_id: orgId,
    }, { onConflict: "id" });

    // Upsert organization_users row
    const { data: existingOrgUser } = await supabase
      .from("organization_users")
      .select("id")
      .eq("user_id", authUserId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (existingOrgUser) {
      await supabase
        .from("organization_users")
        .update({
          first_name: contact.name,
          surname: contact.surname,
          email,
          role: "garage_user",
          title: "Garage Administrator",
          phone_mobile: contact.mobile_phone || null,
          phone_office: contact.phone || null,
          is_active: true,
        })
        .eq("id", existingOrgUser.id);
    } else {
      await supabase.from("organization_users").insert({
        user_id: authUserId,
        organization_id: orgId,
        email,
        first_name: contact.name,
        surname: contact.surname,
        role: "garage_user",
        title: "Garage Administrator",
        phone_mobile: contact.mobile_phone || null,
        phone_office: contact.phone || null,
        is_main_user: false,
        is_active: true,
      });
    }

    return new Response(JSON.stringify({ success: true, userId: authUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("create-garage-contact-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
