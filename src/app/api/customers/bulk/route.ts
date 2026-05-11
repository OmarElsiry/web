import { NextResponse } from "next/server";
import getPrisma from "@/lib/prisma";

const prisma = getPrisma();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid data format. Expected an array." }, { status: 400 });
    }

    let createdCount = 0;
    const errors = [];

    for (const item of data) {
      try {
        if (!item.name) continue;

        await prisma.customer.create({
          data: {
            name: item.name,
            phone: item.phone || null,
            address: item.address || null,
            governorate: item.governorate || null,
            balance: item.balance ? parseFloat(item.balance) : 0,
          }
        });
        createdCount++;
      } catch (err: any) {
        errors.push(`Failed to import customer ${item.name}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${createdCount} customers.`,
      createdCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk import" },
      { status: 500 }
    );
  }
}
