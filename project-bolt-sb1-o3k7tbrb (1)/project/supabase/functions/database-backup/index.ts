import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      throw new Error("Only super admins can create backups");
    }

    const { backup_type, tables } = await req.json();

    const backupLog = await supabase
      .from("backup_logs")
      .insert({
        created_by: user.id,
        backup_type: backup_type || "full",
        tables_included: tables || [],
        status: "in_progress",
      })
      .select()
      .single();

    if (backupLog.error) {
      throw backupLog.error;
    }

    const tablesToBackup = tables && tables.length > 0 ? tables : [
      "organizations",
      "organization_users",
      "profiles",
      "vehicles",
      "drivers",
      "garages",
      "garage_contacts",
      "fuel_transactions",
      "daily_eft_batches",
      "eft_batch_items",
      "custom_report_templates",
      "vehicle_draw_return_records",
    ];

    const backup: Record<string, any> = {
      backup_date: new Date().toISOString(),
      version: "1.0",
      tables: {},
    };

    for (const table of tablesToBackup) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*");

        if (error) {
          console.error(`Error backing up table ${table}:`, error);
          continue;
        }

        backup.tables[table] = data;
      } catch (err) {
        console.error(`Failed to backup table ${table}:`, err);
      }
    }

    const backupJson = JSON.stringify(backup, null, 2);
    const fileSize = new Blob([backupJson]).size;

    await supabase
      .from("backup_logs")
      .update({
        status: "completed",
        file_size: fileSize,
        tables_included: tablesToBackup,
      })
      .eq("id", backupLog.data.id);

    return new Response(
      backupJson,
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="backup-${new Date().toISOString()}.json"`,
        },
      }
    );
  } catch (error) {
    console.error("Backup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});