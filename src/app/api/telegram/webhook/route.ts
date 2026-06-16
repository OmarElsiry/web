import { NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/services/telegram-handlers';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Verify webhook secret
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const update = await request.json();
        
        // Process update asynchronously so we return 200 OK to Telegram immediately
        // (Vercel serverless functions will usually stay alive long enough to process this)
        // If it takes too long, Telegram might retry, but we want to avoid blocking.
        // The proper way in Next.js App Router to do background work is just not to await,
        // though Vercel might kill the process. For simple bots, awaiting is safer to ensure it finishes.
        await handleTelegramUpdate(update);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        // Always return 200 to Telegram so it doesn't retry indefinitely
        return NextResponse.json({ success: false, error: 'Internal server error' });
    }
}
