"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseReady } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  if (supabaseReady) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
