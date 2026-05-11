/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import getPrisma from "@/lib/prisma";

const prisma = getPrisma();

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid data format. Expected an array." }, { status: 400 });
    }

    const validData = data
      .filter((item: any) => item.name)
      .map((item: any) => ({
        name: item.name,
        phone: item.phone || null,
        address: item.address || null,
        governorate: item.governorate || null,
        balance: item.balance ? parseFloat(item.balance) : 0,
      }));

    if (validData.length === 0) {
      return NextResponse.json({ message: "No valid customers to import.", createdCount: 0 });
    }

    const result = await prisma.customer.createMany({
      data: validData,
      skipDuplicates: true,
    });

    return NextResponse.json({
      message: `Successfully imported ${result.count} customers.`,
      createdCount: result.count,
    });

  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk import" },
      { status: 500 }
    );
  }
}
