import { NextResponse } from 'next/server';
import getPrisma from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/auth';

export async function GET() {
    try {
        const prisma = getPrisma();
        const user = await getCurrentUser();

        if (!user || (user.role !== 'ROOT' && user.role !== 'ADMIN')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [products, customers, invoices] = await Promise.all([
            prisma.product.findMany({
                include: {
                    category: true,
                }
            }),
            prisma.customer.findMany({
                include: {
                    group: true,
                }
            }),
            prisma.invoice.findMany({
                include: {
                    items: true,
                    customer: true,
                    user: true,
                    refunds: {
                        include: {
                            items: true
                        }
                    }
                }
            })
        ]);

        const backupData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                exportedBy: user.username,
                version: '1.0'
            },
            data: {
                products,
                customers,
                invoices
            }
        };

        return new NextResponse(JSON.stringify(backupData, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="stash-backup-${new Date().toISOString().split('T')[0]}.json"`,
            },
        });

    } catch (error: any) {
        console.error('Backup error:', error);
        return NextResponse.json({ error: 'Failed to generate backup' }, { status: 500 });
    }
}
