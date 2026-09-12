import { supabase } from "../lib/supabaseClient.js";

const PRODUCT_IMAGE_BUCKET = "product-images";
const CACHE_PREFIX = "beulah-catalog-v1:";
const CACHE_TTL_MS = 60 * 1000;

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.data || !Number.isFinite(entry.cachedAt)) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // Storage is optional; Supabase remains the source of truth.
  }
}

async function getOrRefresh(key, fetcher) {
  const cached = readCache(key);
  if (cached) {
    if (Date.now() - cached.cachedAt >= CACHE_TTL_MS) {
      fetcher().then((data) => writeCache(key, data)).catch((error) => console.warn("Catalog background refresh failed", error));
    }
    return cached.data;
  }
  const data = await fetcher();
  writeCache(key, data);
  return data;
}

export function getProductImageUrl(imagePath) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}

export async function getCategories() {
  return getOrRefresh("categories", async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, description")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export async function getProducts({ categorySlug = "", page = 1, pageSize = 12 } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 12));
  const cacheKey = `products:${categorySlug}:${safePage}:${safePageSize}`;

  return getOrRefresh(cacheKey, async () => {
    let query = supabase
      .from("products")
      .select("id, category_id, name, slug, description, price, image_url, stock_quantity", { count: "exact" })
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
      if (!category) return { products: [], count: 0, page: safePage, pageSize: safePageSize, totalPages: 0 };
      query = query.eq("category_id", category.id);
    }

    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return {
      products: (data ?? []).map((product) => ({ ...product, image_src: getProductImageUrl(product.image_url) })),
      count: count ?? 0,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil((count ?? 0) / safePageSize),
    };
  });
}

export async function getProductsByIds(ids = []) {
  const productIds = [...new Set(ids.map(String).filter(Boolean))].sort();
  if (!productIds.length) return [];
  return getOrRefresh(`products-by-id:${productIds.join(",")}`, async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, category_id, name, slug, description, price, image_url, stock_quantity")
      .in("id", productIds)
      .eq("is_active", true);
    if (error) throw error;
    return (data ?? []).map((product) => ({ ...product, image_src: getProductImageUrl(product.image_url) }));
  });
}

export async function getProductBySlug(slug) {
  return getOrRefresh(`product:${slug}`, async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, category_id, name, slug, description, price, image_url, stock_quantity")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data ? { ...data, image_src: getProductImageUrl(data.image_url) } : data;
  });
}
