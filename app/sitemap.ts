import { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, slug, updated_at");

  for (const tenant of tenants || []) {
    routes.push({
      url: `${baseUrl}/store/${tenant.slug}`,
      lastModified: tenant.updated_at || new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    });

    const { data: categories } = await supabase
      .from("categories")
      .select("slug, updated_at")
      .eq("tenant_id", tenant.id);

    for (const category of categories || []) {
      routes.push({
        url: `${baseUrl}/store/${tenant.slug}/categories/${category.slug}`,
        lastModified: category.updated_at || new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    const { data: products } = await supabase
      .from("products")
      .select("id, updated_at")
      .eq("tenant_id", tenant.id)
      .eq("status", "active");

    for (const product of products || []) {
      routes.push({
        url: `${baseUrl}/store/${tenant.slug}/products/${product.id}`,
        lastModified: product.updated_at || new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return routes;
}