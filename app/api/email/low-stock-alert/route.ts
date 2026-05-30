import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { tenantId } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required." },
        { status: 400 }
      );
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("tenant_id", tenant.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .single();

    if (!ownerProfile?.email) {
      return NextResponse.json(
        { error: "Store owner email not found." },
        { status: 400 }
      );
    }

    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, inventory, low_stock_threshold")
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .order("inventory", { ascending: true });

    const lowStockProducts = (productsData || []).filter(
      (product) =>
        Number(product.inventory) <= Number(product.low_stock_threshold || 5)
    );

    const { data: variantsData } = await supabase
      .from("product_variants")
      .select(`
        id,
        name,
        option_name,
        option_value,
        inventory,
        low_stock_threshold,
        product:products (
          id,
          name
        )
      `)
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .order("inventory", { ascending: true });

    const lowStockVariants = (variantsData || []).filter(
      (variant) =>
        Number(variant.inventory) <= Number(variant.low_stock_threshold || 5)
    );

    if (lowStockProducts.length === 0 && lowStockVariants.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No low stock products or variants found.",
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const productIds = lowStockProducts.map((product) => product.id);
    const variantIds = lowStockVariants.map((variant) => variant.id);

    let existingProductLogs: any[] = [];
    let existingVariantLogs: any[] = [];

    if (productIds.length > 0) {
      const { data } = await supabase
        .from("low_stock_alert_logs")
        .select("product_id")
        .eq("tenant_id", tenant.id)
        .in("product_id", productIds)
        .is("variant_id", null)
        .gte("created_at", todayStart.toISOString());

      existingProductLogs = data || [];
    }

    if (variantIds.length > 0) {
      const { data } = await supabase
        .from("low_stock_alert_logs")
        .select("variant_id")
        .eq("tenant_id", tenant.id)
        .in("variant_id", variantIds)
        .gte("created_at", todayStart.toISOString());

      existingVariantLogs = data || [];
    }

    const alreadyAlertedProductIds = new Set(
      existingProductLogs.map((log) => log.product_id)
    );

    const alreadyAlertedVariantIds = new Set(
      existingVariantLogs.map((log) => log.variant_id)
    );

    const productsToAlert = lowStockProducts.filter(
      (product) => !alreadyAlertedProductIds.has(product.id)
    );

    const variantsToAlert = lowStockVariants.filter(
      (variant) => !alreadyAlertedVariantIds.has(variant.id)
    );

    if (productsToAlert.length === 0 && variantsToAlert.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Low stock alerts already sent today.",
      });
    }

    const productRowsHtml = productsToAlert
      .map(
        (product) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              ${product.name}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              Base Product
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              ${product.inventory}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              ${product.low_stock_threshold || 5}
            </td>
          </tr>
        `
      )
      .join("");

    const variantRowsHtml = variantsToAlert
      .map((variant: any) => {
        const product = Array.isArray(variant.product)
          ? variant.product[0]
          : variant.product;

        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              ${product?.name || "Product"} — ${variant.name}
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                ${variant.option_name}: ${variant.option_value}
              </div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              Variant
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              ${variant.inventory}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              ${variant.low_stock_threshold || 5}
            </td>
          </tr>
        `;
      })
      .join("");

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "StoreForge <onboarding@resend.dev>",
      to: [ownerProfile.email],
      subject: `Low stock alert for ${tenant.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px;">
          <div style="max-width: 760px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden;">
            <div style="background: #020617; color: white; padding: 28px;">
              <h1 style="margin: 0;">Low Stock Alert</h1>
              <p style="margin: 8px 0 0;">${tenant.name}</p>
            </div>

            <div style="padding: 28px;">
              <h2 style="margin-top: 0;">Some inventory needs restocking</h2>

              <p>
                The following products or variants are at or below their low stock threshold.
                Alerts for the same item are sent only once per day.
              </p>

              <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
                <thead>
                  <tr>
                    <th style="text-align: left; padding: 12px;">Item</th>
                    <th style="text-align: center; padding: 12px;">Type</th>
                    <th style="text-align: center; padding: 12px;">Current Stock</th>
                    <th style="text-align: center; padding: 12px;">Threshold</th>
                  </tr>
                </thead>

                <tbody>
                  ${productRowsHtml}
                  ${variantRowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    const productLogRows = productsToAlert.map((product) => ({
      tenant_id: tenant.id,
      product_id: product.id,
      variant_id: null,
      inventory: Number(product.inventory),
      threshold: Number(product.low_stock_threshold || 5),
      alert_type: "email",
    }));

    const variantLogRows = variantsToAlert.map((variant: any) => {
      const product = Array.isArray(variant.product)
        ? variant.product[0]
        : variant.product;

      return {
        tenant_id: tenant.id,
        product_id: product?.id || null,
        variant_id: variant.id,
        inventory: Number(variant.inventory),
        threshold: Number(variant.low_stock_threshold || 5),
        alert_type: "email",
      };
    });

    const logRows = [...productLogRows, ...variantLogRows];

    if (logRows.length > 0) {
      const { error: insertLogError } = await supabase
        .from("low_stock_alert_logs")
        .insert(logRows);

      if (insertLogError) {
        console.error("Failed to insert low stock alert logs:", insertLogError);
      }
    }

    return NextResponse.json({
      success: true,
      sentTo: ownerProfile.email,
      productCount: productsToAlert.length,
      variantCount: variantsToAlert.length,
      skippedAlreadyAlerted:
        lowStockProducts.length +
        lowStockVariants.length -
        productsToAlert.length -
        variantsToAlert.length,
      data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to send low stock alert." },
      { status: 500 }
    );
  }
}