import { createAdminClient } from '@/lib/supabase/admin';
import { Category, MenuItem } from '@/types/database';

export interface PublicCafeSettings {
  cafe_name: string;
  gst_rate_percent: number;
  tax_enabled: boolean;
}

interface MenuCacheEntry {
  categories: Category[];
  menuItems: MenuItem[];
  settings: PublicCafeSettings;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
let menuCache: MenuCacheEntry | null = null;
let inflightMenuFetch: Promise<Omit<MenuCacheEntry, 'expiresAt'>> | null = null;

export function parsePublicSettings(
  row?: {
    cafe_name?: string | null;
    gst_rate_percent?: number | string | null;
    cafe_tagline?: string | null;
    tax_enabled?: boolean | null;
  } | null
): PublicCafeSettings {
  let taxEnabled = row?.tax_enabled ?? true;
  if (row?.cafe_tagline && row.cafe_tagline.trim().startsWith('{')) {
    try {
      const meta = JSON.parse(row.cafe_tagline);
      if (meta.tax_enabled !== undefined) {
        taxEnabled = Boolean(meta.tax_enabled);
      }
    } catch {
      // Ignore malformed tagline JSON
    }
  }
  return {
    cafe_name: row?.cafe_name || 'Brew & Bites Cafe',
    gst_rate_percent: Number(row?.gst_rate_percent) || 5.0,
    tax_enabled: Boolean(taxEnabled),
  };
}

export async function getCachedMenuAndSettings(): Promise<{
  categories: Category[];
  menuItems: MenuItem[];
  settings: PublicCafeSettings;
}> {
  const now = Date.now();
  if (menuCache && menuCache.expiresAt > now) {
    return {
      categories: menuCache.categories,
      menuItems: menuCache.menuItems,
      settings: menuCache.settings,
    };
  }

  if (inflightMenuFetch) {
    return inflightMenuFetch;
  }

  inflightMenuFetch = (async () => {
    try {
      const supabaseAdmin = createAdminClient();
      const [catRes, itemRes, setRes] = await Promise.all([
        supabaseAdmin.from('categories').select('*').order('display_order', { ascending: true }),
        supabaseAdmin.from('menu_items').select('*').order('name_en', { ascending: true }),
        supabaseAdmin
          .from('manager_settings')
          .select('cafe_name, gst_rate_percent, cafe_tagline')
          .eq('id', 1)
          .maybeSingle(),
      ]);

      const entry = {
        categories: (catRes.data || []) as Category[],
        menuItems: (itemRes.data || []) as MenuItem[],
        settings: parsePublicSettings(setRes.data),
      };

      menuCache = {
        ...entry,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };

      return entry;
    } finally {
      inflightMenuFetch = null;
    }
  })();

  return inflightMenuFetch;
}

export function invalidateMenuCache() {
  menuCache = null;
}
