import { supabase } from "../lib/supabaseClient.js";

export async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getProducts({ categorySlug = "" } = {}) {
  let query = supabase
    .from("products")
    .select("id, category_id, name, slug, description, price, image_url, stock_quantity")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (categorySlug) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .eq("is_active", true)
      .maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) return [];
    query = query.eq("category_id", category.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getProductBySlug(slug) {
  const { data, error } = await supabase
    .from("products")
    .select("id, category_id, name, slug, description, price, image_url, stock_quantity")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}
