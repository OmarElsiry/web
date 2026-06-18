import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import getPrisma from '@/lib/prisma';
import { generateInvoicePdfBuffer } from '@/lib/services/pdf-generator';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const prisma = getPrisma();
    const { id } = await params;

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { items: { include: { product: true } }, user: { select: { name: true, username: true, phone: true, address: true } } }
    });

    if (!invoice) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        const buffer = await generateInvoicePdfBuffer(invoice);

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200'
            },
        });
    } catch (error) {
        console.error('PDF Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
