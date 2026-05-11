/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import getPrisma from "@/lib/prisma";

const prisma = getPrisma();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const governorate = searchParams.get("governorate");
    const customerId = searchParams.get("customerId");

    const where: any = {
      balance: { gt: 0 } // Only get customers with debt
    };

    if (governorate) {
      where.governorate = governorate;
    }

    if (customerId) {
      where.id = customerId;
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: [
        { governorate: 'asc' },
        { name: 'asc' }
      ]
    });

    // Also get unique governorates for the filter dropdown
    const uniqueGovernorates = await prisma.customer.findMany({
      select: { governorate: true },
      distinct: ['governorate'],
      where: {
        governorate: { not: null }
      }
    });

    const governoratesList = uniqueGovernorates
      .map((c: { governorate: string | null }) => c.governorate)
      .filter(Boolean);

    return NextResponse.json({
      customers,
      governorates: governoratesList
    });
  } catch (error) {
    console.error("Failed to fetch debts report:", error);
    return NextResponse.json(
      { error: "Failed to fetch debts report" },
      { status: 500 }
    );
  }
}
