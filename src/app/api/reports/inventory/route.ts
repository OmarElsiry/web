import { NextResponse } from 'next/server';
import getPrisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

const prisma = getPrisma();

export async function GET(request: Request) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        inventoryItems: {
          include: {
            location: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    const formattedProducts = products.map((p) => {
      const totalStock = p.inventoryItems.reduce((acc, curr) => acc + Number(curr.quantity), 0);
      const costPrice = Number(p.costPrice);
      const baseSellingPrice = Number(p.baseSellingPrice);

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        category: p.category?.name || 'Uncategorized',
        costPrice,
        baseSellingPrice,
        totalStock,
        totalCostValue: totalStock * costPrice,
        totalSellValue: totalStock * baseSellingPrice,
        locations: p.inventoryItems.map(inv => ({
          locationName: inv.location.name,
          quantity: Number(inv.quantity)
        }))
      };
    });

    // Summary calculations
    const summary = formattedProducts.reduce(
      (acc, p) => {
        acc.totalUniqueItems += 1;
        acc.totalStockQuantity += p.totalStock;
        acc.totalCostValuation += p.totalCostValue;
        acc.totalRetailValuation += p.totalSellValue;
        return acc;
      },
      {
        totalUniqueItems: 0,
        totalStockQuantity: 0,
        totalCostValuation: 0,
        totalRetailValuation: 0,
      }
    );

    return NextResponse.json({
      products: formattedProducts,
      summary
    });
  } catch (error: any) {
    console.error('Failed to fetch inventory report data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory report: ' + error.message },
      { status: 500 }
    );
  }
}
