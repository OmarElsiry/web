/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Telegram Bot Handlers
 * 
 * Processes incoming Telegram updates (messages + callback queries)
 * and routes them to the appropriate flow handler.
 */

import {
    sendMessage, answerCallback, sendDocument,
    btn, mainMenuKeyboard, navRow,
    type InlineKeyboard,
} from './telegram';
import {
    getState, clearState, startSaleFlow, startInvoiceSearchFlow, startStockSearchFlow,
    updateSaleState, addToCart, removeFromCart, getCartTotal, formatCartSummary,
    type SaleState,
} from './telegram-state';
import getPrisma from '@/lib/prisma';

// ─── Main Update Router ────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: any): Promise<void> {
    try {
        if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
        } else if (update.message?.text) {
            await handleTextMessage(update.message);
        }
    } catch (error) {
        console.error('Telegram handler error:', error);
        const chatId = update.callback_query?.message?.chat?.id || update.message?.chat?.id;
        if (chatId) {
            await sendMessage(chatId, '❌ حدث خطأ في الاتصال\n\nلم نتمكن من إتمام العملية. يرجى المحاولة مرة أخرى.', [
                [btn('🔄 إعادة المحاولة', 'menu:main'), btn('🏠 القائمة', 'menu:main')],
            ]);
        }
    }
}

// ─── Text Message Handler ───────────────────────────────────────────────────

async function handleTextMessage(message: any): Promise<void> {
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    
    // Check for commands first
    if (text === '/start' || text === '/menu') {
        clearState(chatId);
        await sendMainMenu(chatId);
        return;
    }
    
    // Check if user is in a flow that expects text input
    const state = getState(chatId);
    if (state) {
        switch (state.flow) {
            case 'sale':
                await handleSaleTextInput(chatId, text, state);
                return;
            case 'invoice_search':
                await handleInvoiceTextInput(chatId, text);
                return;
            case 'stock_search':
                await handleStockTextInput(chatId, text);
                return;
        }
    }
    
    // No active flow — show main menu
    await sendMainMenu(chatId);
}

// ─── Callback Query Handler ─────────────────────────────────────────────────

async function handleCallbackQuery(query: any): Promise<void> {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    // Always answer the callback to dismiss spinner
    await answerCallback(query.id);
    
    // Parse callback data (format: "action:value" or "action:subaction:value")
    const [action, ...rest] = data.split(':');
    const value = rest.join(':');
    
    switch (action) {
        case 'menu':
            await handleMenuAction(chatId, value);
            break;
        case 'cancel':
            clearState(chatId);
            await sendMainMenu(chatId);
            break;
        case 'sale':
            await handleSaleCallback(chatId, value);
            break;
        case 'inv':
            await handleInvoiceCallback(chatId, value);
            break;
        case 'stk':
            await handleStockCallback(chatId, value);
            break;
        case 'today':
            await handleTodayCallback(chatId, value);
            break;
        default:
            await sendMainMenu(chatId);
    }
}

// ─── Main Menu ──────────────────────────────────────────────────────────────

async function sendMainMenu(chatId: number): Promise<void> {
    await sendMessage(
        chatId,
        '🏪 <b>STASH — نقطة البيع</b>\n\nمرحباً! اختر من القائمة:',
        mainMenuKeyboard()
    );
}

async function handleMenuAction(chatId: number, action: string): Promise<void> {
    switch (action) {
        case 'main':
            clearState(chatId);
            await sendMainMenu(chatId);
            break;
        case 'sale':
            await startSaleWizard(chatId);
            break;
        case 'invoice':
            await startInvoiceLookup(chatId);
            break;
        case 'stock':
            await startStockQuery(chatId);
            break;
        case 'today':
            await sendTodaySummary(chatId);
            break;
        case 'settings':
            await sendMessage(chatId, '⚙️ <b>الإعدادات</b>\n\nقريباً...', [
                navRow({ home: true }),
            ]);
            break;
    }
}

// ─── FLOW 1: Quick Sale Wizard ──────────────────────────────────────────────

async function startSaleWizard(chatId: number): Promise<void> {
    startSaleFlow(chatId);
    
    await sendMessage(
        chatId,
        '🛒 <b>بيع سريع — الخطوة 1/4</b>\n\nابحث عن المنتج:\nاكتب اسم المنتج أو رقم الباركود...',
        [
            [btn('📂 تصفح الأصناف', 'sale:browse_cats')],
            navRow({ cancel: true }),
        ]
    );
}

async function handleSaleTextInput(chatId: number, text: string, state: SaleState): Promise<void> {
    switch (state.step) {
        case 'product_search':
            await searchProducts(chatId, text);
            break;
        case 'quantity': {
            const qty = parseInt(text, 10);
            if (isNaN(qty) || qty <= 0) {
                await sendMessage(chatId, '⚠️ يرجى إدخال رقم صحيح أكبر من 0', [
                    navRow({ back: 'sale:back_to_search', cancel: true }),
                ]);
                return;
            }
            await handleQuantitySelection(chatId, qty);
            break;
        }
        case 'customer_search':
            await searchCustomersForSale(chatId, text);
            break;
        case 'customer':
            // User typed a new customer name
            updateSaleState(chatId, { customer: { name: text, balance: 0 }, step: 'payment' });
            await sendPaymentStep(chatId);
            break;
        case 'amount_paid': {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount < 0) {
                await sendMessage(chatId, '⚠️ يرجى إدخال مبلغ صحيح');
                return;
            }
            await handleAmountPaid(chatId, amount);
            break;
        }
        default:
            await searchProducts(chatId, text);
            break;
    }
}

async function handleSaleCallback(chatId: number, value: string): Promise<void> {
    const state = getState(chatId);
    if (!state || state.flow !== 'sale') {
        await startSaleWizard(chatId);
        return;
    }
    
    // Prefix matching
    if (value.startsWith('cat:')) return browseProductsInCategory(chatId, value.substring(4));
    if (value.startsWith('prod:')) return selectProduct(chatId, value.substring(5));
    if (value.startsWith('qty:')) return handleQuantitySelection(chatId, parseInt(value.substring(4), 10));
    if (value.startsWith('cust:')) return selectCustomer(chatId, value.substring(5));

    switch (value) {
        case 'browse_cats': return browseCategoriesStep(chatId);
        case 'custom_qty': return handleSaleCustomQty(chatId);
        case 'add_more': return handleSaleAddMore(chatId);
        case 'remove_last': return handleSaleRemoveLast(chatId, state as SaleState);
        case 'checkout': return handleSaleCheckout(chatId);
        case 'skip_customer': return handleSaleSkipCustomer(chatId);
        case 'new_customer': return handleSaleNewCustomer(chatId);
        case 'pay_cash': return handlePaymentMethod(chatId, 'CASH');
        case 'pay_instapay': return handlePaymentMethod(chatId, 'INSTAPAY');
        case 'pay_credit': return handlePaymentMethod(chatId, 'CREDIT');
        case 'pay_full': return handleSalePayFull(chatId, state as SaleState);
        case 'pay_custom': return handleSalePayCustom(chatId);
        case 'confirm_sale': return processSaleFromBot(chatId);
        case 'new_sale': return startSaleWizard(chatId);
        case 'back_to_search': return handleSaleBackToSearch(chatId);
        case 'back_to_cart': return sendCartReview(chatId);
    }
}

async function handleSaleCustomQty(chatId: number) {
    updateSaleState(chatId, { step: 'quantity' });
    await sendMessage(chatId, '✏️ اكتب الكمية المطلوبة:', [navRow({ back: 'sale:back_to_search', cancel: true })]);
}
async function handleSaleAddMore(chatId: number) {
    updateSaleState(chatId, { step: 'product_search' });
    await sendMessage(chatId, '🛒 ابحث عن منتج آخر لإضافته:', [[btn('📂 تصفح الأصناف', 'sale:browse_cats')], navRow({ cancel: true })]);
}
async function handleSaleRemoveLast(chatId: number, state: SaleState) {
    if (state.cart.length > 0) removeFromCart(chatId, state.cart[state.cart.length - 1].productId);
    const updated = getState(chatId) as SaleState;
    if (updated.cart.length === 0) {
        updateSaleState(chatId, { step: 'product_search' });
        await sendMessage(chatId, '🛒 السلة فارغة. ابحث عن منتج:', [[btn('📂 تصفح الأصناف', 'sale:browse_cats')], navRow({ cancel: true })]);
    } else {
        await sendCartReview(chatId);
    }
}
async function handleSaleCheckout(chatId: number) {
    updateSaleState(chatId, { step: 'customer' });
    await sendCustomerStep(chatId);
}
async function handleSaleSkipCustomer(chatId: number) {
    updateSaleState(chatId, { step: 'payment' });
    await sendPaymentStep(chatId);
}
async function handleSaleNewCustomer(chatId: number) {
    updateSaleState(chatId, { step: 'customer' });
    await sendMessage(chatId, '👤 اكتب اسم العميل الجديد:', [navRow({ back: 'sale:checkout', cancel: true })]);
}
async function handleSalePayFull(chatId: number, state: SaleState) {
    await handleAmountPaid(chatId, getCartTotal(state));
}
async function handleSalePayCustom(chatId: number) {
    updateSaleState(chatId, { step: 'amount_paid' });
    await sendMessage(chatId, '✏️ اكتب المبلغ المدفوع:', [navRow({ back: 'sale:checkout', cancel: true })]);
}
async function handleSaleBackToSearch(chatId: number) {
    updateSaleState(chatId, { step: 'product_search' });
    await sendMessage(chatId, '🔍 ابحث عن المنتج:', [[btn('📂 تصفح الأصناف', 'sale:browse_cats')], navRow({ cancel: true })]);
}

async function searchProducts(chatId: number, query: string): Promise<void> {
    const prisma = getPrisma();
    const location = await prisma.location.findFirst();
    
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } },
            ],
        },
        take: 8,
        include: { category: true },
    });
    
    if (products.length === 0) {
        await sendMessage(chatId, `🔍 لم يتم العثور على نتائج لـ "${query}"\n\nجرب بحث آخر:`, [
            [btn('📂 تصفح الأصناف', 'sale:browse_cats')],
            navRow({ cancel: true }),
        ]);
        return;
    }
    
    // Get stock for each product
    const inventories = location ? await prisma.inventory.findMany({
        where: {
            locationId: location.id,
            productId: { in: products.map(p => p.id) },
        },
    }) : [];
    const stockMap = new Map(inventories.map(inv => [inv.productId, Number(inv.quantity)]));
    
    const buttons: InlineKeyboard = products.map(p => {
        const stock = stockMap.get(p.id) || 0;
        const price = Number(p.baseSellingPrice);
        let stockEmoji = '🟢';
        if (stock <= 0) stockEmoji = '🔴';
        else if (stock < 5) stockEmoji = '🟡';
        return [btn(`${stockEmoji} ${p.name} — ${price} ج.م (${stock})`, `sale:prod:${p.id}`)];
    });
    
    buttons.push([btn('🔍 بحث آخر', 'sale:back_to_search')]);
    buttons.push(navRow({ cancel: true }));
    
    await sendMessage(chatId, `🔍 نتائج البحث عن "<b>${query}</b>":`, buttons);
}

async function browseCategoriesStep(chatId: number): Promise<void> {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
    });
    
    if (categories.length === 0) {
        await sendMessage(chatId, '📂 لا توجد فئات. ابحث عن المنتج مباشرة:', [
            navRow({ back: 'sale:back_to_search', cancel: true }),
        ]);
        return;
    }
    
    const rows: InlineKeyboard = [];
    for (let i = 0; i < categories.length; i += 2) {
        const row = [btn(`📁 ${categories[i].name} (${categories[i]._count.products})`, `sale:cat:${categories[i].id}`)];
        if (categories[i + 1]) {
            row.push(btn(`📁 ${categories[i + 1].name} (${categories[i + 1]._count.products})`, `sale:cat:${categories[i + 1].id}`));
        }
        rows.push(row);
    }
    rows.push(navRow({ back: 'sale:back_to_search', cancel: true }));
    
    await sendMessage(chatId, '📂 <b>اختر الفئة:</b>', rows);
}

async function browseProductsInCategory(chatId: number, categoryId: string): Promise<void> {
    const prisma = getPrisma();
    const location = await prisma.location.findFirst();
    
    const products = await prisma.product.findMany({
        where: { categoryId },
        include: { category: true },
        take: 15,
        orderBy: { name: 'asc' },
    });
    
    const inventories = location ? await prisma.inventory.findMany({
        where: {
            locationId: location.id,
            productId: { in: products.map(p => p.id) },
        },
    }) : [];
    const stockMap = new Map(inventories.map(inv => [inv.productId, Number(inv.quantity)]));
    
    const catName = products[0]?.category?.name || 'الفئة';
    
    const buttons: InlineKeyboard = products
        .filter(p => (stockMap.get(p.id) || 0) > 0) // Only show in-stock
        .map(p => {
            const stock = stockMap.get(p.id) || 0;
            return [btn(`${p.name} (متاح: ${stock})`, `sale:prod:${p.id}`)];
        });
    
    if (buttons.length === 0) {
        await sendMessage(chatId, `📂 ${catName} — لا توجد أصناف متاحة`, [
            [btn('↩️ الفئات', 'sale:browse_cats')],
            navRow({ cancel: true }),
        ]);
        return;
    }
    
    buttons.push([btn('↩️ الفئات', 'sale:browse_cats')]);
    buttons.push(navRow({ cancel: true }));
    
    await sendMessage(chatId, `📂 <b>${catName}</b> — اختر المنتج:`, buttons);
}

async function selectProduct(chatId: number, productId: string): Promise<void> {
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
        await sendMessage(chatId, '⚠️ المنتج غير موجود');
        return;
    }
    
    const location = await prisma.location.findFirst();
    const inventory = location ? await prisma.inventory.findFirst({
        where: { productId, locationId: location.id },
    }) : null;
    const stock = inventory ? Number(inventory.quantity) : 0;
    
    updateSaleState(chatId, {
        selectedProduct: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: Number(product.baseSellingPrice),
            stock,
        },
    });
    
    // Quick quantity buttons
    const qtyButtons: InlineKeyboard = [
        [btn('1', 'sale:qty:1'), btn('2', 'sale:qty:2'), btn('3', 'sale:qty:3')],
        [btn('4', 'sale:qty:4'), btn('5', 'sale:qty:5'), btn('10', 'sale:qty:10')],
        [btn('✏️ كمية أخرى', 'sale:custom_qty'), btn('↩️ رجوع', 'sale:back_to_search')],
    ];
    
    await sendMessage(
        chatId,
        `🛒 <b>بيع سريع — الخطوة 2/4</b>\n\nالمنتج: <b>${product.name}</b>\nالسعر: ${Number(product.baseSellingPrice).toLocaleString('ar-EG')} ج.م\nالمتاح: ${stock} قطعة\n\nاختر الكمية:`,
        qtyButtons
    );
}

async function handleQuantitySelection(chatId: number, quantity: number): Promise<void> {
    const state = getState(chatId) as SaleState;
    if (!state?.selectedProduct) return;
    
    if (quantity > state.selectedProduct.stock) {
        await sendMessage(
            chatId,
            `⚠️ <b>الكمية غير متاحة</b>\n\nالمنتج: ${state.selectedProduct.name}\nالمطلوب: ${quantity} قطعة\nالمتاح: ${state.selectedProduct.stock} قطعة فقط`,
            [
                [btn('✏️ تغيير الكمية', 'sale:custom_qty'), btn('🗑 حذف', 'sale:back_to_search')],
                navRow({ cancel: true }),
            ]
        );
        return;
    }
    
    // Add to cart
    addToCart(chatId, {
        productId: state.selectedProduct.id,
        name: state.selectedProduct.name,
        sku: state.selectedProduct.sku,
        quantity,
        unitPrice: state.selectedProduct.price,
        stock: state.selectedProduct.stock,
    });
    
    await sendCartReview(chatId);
}

async function sendCartReview(chatId: number): Promise<void> {
    const state = getState(chatId) as SaleState;
    if (!state) return;
    
    const summary = formatCartSummary(state);
    
    await sendMessage(chatId, summary, [
        [btn('➕ إضافة صنف', 'sale:add_more'), btn('🗑 حذف آخر', 'sale:remove_last')],
        [btn('✅ متابعة الدفع', 'sale:checkout'), btn('❌ إلغاء', 'cancel')],
    ]);
}

async function sendCustomerStep(chatId: number): Promise<void> {
    const state = getState(chatId) as SaleState;
    if (!state) return;
    
    const total = getCartTotal(state);
    
    await sendMessage(
        chatId,
        `🛒 <b>بيع سريع — الخطوة 3/4</b>\n\nالإجمالي: <b>${total.toLocaleString('ar-EG')} ج.م</b>\n\nبيانات العميل (اختياري):\nاكتب اسم العميل للبحث:`,
        [
            [btn('👤 بدون عميل (كاش سريع)', 'sale:skip_customer')],
            navRow({ back: 'sale:back_to_cart', cancel: true }),
        ]
    );
    
    updateSaleState(chatId, { step: 'customer_search' });
}

async function searchCustomersForSale(chatId: number, query: string): Promise<void> {
    const prisma = getPrisma();
    
    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query } },
            ],
        },
        take: 5,
        orderBy: { name: 'asc' },
    });
    
    const buttons: InlineKeyboard = customers.map(c => {
        const phoneStr = c.phone ? ` — ${c.phone}` : '';
        const balanceStr = Number(c.balance).toLocaleString('ar-EG');
        return [btn(`${c.name}${phoneStr} (رصيد: ${balanceStr})`, `sale:cust:${c.id}`)];
    });
    
    buttons.push([btn('➕ عميل جديد', 'sale:new_customer')]);
    buttons.push(navRow({ back: 'sale:checkout', cancel: true }));
    
    await sendMessage(chatId, `👥 <b>نتائج البحث:</b>`, buttons);
}

async function selectCustomer(chatId: number, customerId: string): Promise<void> {
    const prisma = getPrisma();
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    
    if (!customer) {
        await sendMessage(chatId, '⚠️ العميل غير موجود');
        return;
    }
    
    updateSaleState(chatId, {
        customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone || undefined,
            balance: Number(customer.balance),
        },
        step: 'payment',
    });
    
    await sendPaymentStep(chatId);
}

async function sendPaymentStep(chatId: number): Promise<void> {
    const state = getState(chatId) as SaleState;
    if (!state) return;
    
    const total = getCartTotal(state);
    const cartText = state.cart.map((item, i) => 
        `${i + 1}. ${item.name} × ${item.quantity} = ${(item.unitPrice * item.quantity).toLocaleString('ar-EG')} ج.م`
    ).join('\n');
    
    let customerLine = '👤 بدون عميل';
    if (state.customer) {
        customerLine = `👤 العميل: ${state.customer.name}`;
        if (state.customer.balance > 0) {
            customerLine += `\n💰 الرصيد السابق: ${state.customer.balance.toLocaleString('ar-EG')} ج.م`;
        }
    }
    
    await sendMessage(
        chatId,
        `🛒 <b>بيع سريع — الخطوة 4/4</b>\n\n📋 ملخص الطلب:\n━━━━━━━━━━━━━━━━━━━\n${customerLine}\n\n${cartText}\n━━━━━━━━━━━━━━━━━━━\nالإجمالي: <b>${total.toLocaleString('ar-EG')} ج.م</b>\n\nاختر طريقة الدفع:`,
        [
            [btn('💵 كاش', 'sale:pay_cash'), btn('📱 انستاباي', 'sale:pay_instapay')],
            [btn('💳 آجل (ائتمان)', 'sale:pay_credit')],
            navRow({ back: 'sale:back_to_cart', cancel: true }),
        ]
    );
}

async function handlePaymentMethod(chatId: number, method: 'CASH' | 'INSTAPAY' | 'CREDIT'): Promise<void> {
    updateSaleState(chatId, { paymentMethod: method });
    
    const state = getState(chatId) as SaleState;
    const total = getCartTotal(state);
    
    if (method === 'CREDIT') {
        // Credit = no payment now
        await handleAmountPaid(chatId, 0);
    } else {
        await sendMessage(
            chatId,
            `💵 الدفع ${method === 'CASH' ? 'كاش' : 'انستاباي'}\n\nالإجمالي: <b>${total.toLocaleString('ar-EG')} ج.م</b>\n\nالمبلغ المدفوع:`,
            [
                [btn(`💰 المبلغ كامل (${total.toLocaleString('ar-EG')})`, 'sale:pay_full')],
                [btn('✏️ مبلغ مختلف', 'sale:pay_custom')],
                navRow({ back: 'sale:checkout', cancel: true }),
            ]
        );
    }
}

async function handleAmountPaid(chatId: number, amount: number): Promise<void> {
    updateSaleState(chatId, { amountPaid: amount, step: 'confirm' });
    
    const state = getState(chatId) as SaleState;
    const total = getCartTotal(state);
    const balance = (state.customer?.balance || 0) + total - amount;
    
    const cartText = state.cart.map((item, i) =>
        `${i + 1}. ${item.name} × ${item.quantity} = ${(item.unitPrice * item.quantity).toLocaleString('ar-EG')} ج.م`
    ).join('\n');
    
    let payMethodAr = 'آجل';
    if (state.paymentMethod === 'CASH') payMethodAr = 'كاش';
    else if (state.paymentMethod === 'INSTAPAY') payMethodAr = 'انستاباي';
    
    let text = `📋 <b>تأكيد الفاتورة</b>\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    if (state.customer) text += `👤 العميل: ${state.customer.name}\n`;
    text += `\n${cartText}\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 الإجمالي: <b>${total.toLocaleString('ar-EG')} ج.م</b>\n`;
    text += `💵 المدفوع: ${amount.toLocaleString('ar-EG')} ج.م\n`;
    text += `💳 طريقة الدفع: ${payMethodAr}\n`;
    if (state.customer) text += `📊 الرصيد الجديد: ${balance.toLocaleString('ar-EG')} ج.م\n`;
    
    await sendMessage(chatId, text, [
        [btn('✅ تأكيد وإصدار الفاتورة', 'sale:confirm_sale')],
        navRow({ back: 'sale:checkout', cancel: true }),
    ]);
}

async function processSaleFromBot(chatId: number): Promise<void> {
    const state = getState(chatId) as SaleState;
    if (!state || state.cart.length === 0) {
        await sendMessage(chatId, '⚠️ السلة فارغة');
        return;
    }
    
    await sendMessage(chatId, '⏳ جاري إصدار الفاتورة...');
    
    try {
        // Import processSale dynamically to avoid circular deps
        const { processSale } = await import('@/app/actions/sales');
        
        const items = state.cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        }));
        
        const buyerInfo = state.customer ? {
            customerName: state.customer.name,
            customerPhone: state.customer.phone,
        } : undefined;
        
        const result = await processSale(
            items,
            state.paymentMethod || 'CASH',
            buyerInfo,
            undefined, // userId (bot doesn't have one)
            undefined, // staffId
            state.amountPaid ?? getCartTotal(state),
            state.customer?.id
        );
        
        if (result.success && result.invoice) {
            await handleSuccessfulBotSale(chatId, state, result.invoice);
        } else {
            await sendMessage(chatId, `❌ فشل إصدار الفاتورة\n\n${result.error || 'خطأ غير معروف'}`, [
                [btn('🔄 إعادة المحاولة', 'sale:confirm_sale'), btn('🏠 القائمة', 'menu:main')],
            ]);
        }
    } catch (error: any) {
        console.error('Sale from Telegram failed:', error);
        await sendMessage(chatId, `❌ حدث خطأ في الاتصال\n\n${error.message || ''}`, [
            [btn('🔄 إعادة المحاولة', 'sale:confirm_sale'), btn('🏠 القائمة', 'menu:main')],
        ]);
    }
}

async function handleSuccessfulBotSale(chatId: number, state: SaleState, invoice: any): Promise<void> {
    const invoiceId = invoice.id;
    const shortId = invoiceId.slice(-4).toUpperCase();
    const total = Number(invoice.totalAmount);
    
    clearState(chatId);
    
    // Send success message
    let successText = `✅ <b>تم إصدار الفاتورة بنجاح!</b>\n\n`;
    successText += `━━━━━━━━━━━━━━━━━━━\n`;
    successText += `📄 فاتورة رقم: #${shortId}\n`;
    successText += `📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
    if (state.customer) successText += `👤 العميل: ${state.customer.name}\n`;
    successText += `💰 الإجمالي: ${total.toLocaleString('ar-EG')} ج.م\n`;
    successText += `━━━━━━━━━━━━━━━━━━━\n`;
    
    await sendMessage(chatId, successText, [
        [btn('🛒 بيع جديد', 'sale:new_sale'), btn('🏠 القائمة', 'menu:main')],
    ]);
    
    // Try to generate and send PDF
    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
        if (appUrl) {
            const protocol = appUrl.startsWith('http') ? '' : 'https://';
            const pdfUrl = `${protocol}${appUrl}/api/invoices/${invoiceId}/pdf`;
            const pdfResponse = await fetch(pdfUrl);
            if (pdfResponse.ok) {
                const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
                await sendDocument(chatId, pdfBuffer, `invoice-${shortId}.pdf`, `📎 فاتورة #${shortId}`);
            }
        }
    } catch (pdfError) {
        console.error('PDF generation for Telegram failed:', pdfError);
        // Not critical — sale was already processed
    }
}

// ─── FLOW 2: Invoice Lookup ─────────────────────────────────────────────────

async function startInvoiceLookup(chatId: number): Promise<void> {
    startInvoiceSearchFlow(chatId);
    
    await sendMessage(
        chatId,
        '📋 <b>بحث عن فاتورة</b>\n\nاكتب رقم الفاتورة أو اسم العميل:',
        [
            [btn('📅 آخر 5 فواتير', 'inv:recent')],
            navRow({ cancel: true }),
        ]
    );
}

async function handleInvoiceTextInput(chatId: number, text: string): Promise<void> {
    const prisma = getPrisma();
    
    // Search by customer name or invoice ID
    const invoices = await prisma.invoice.findMany({
        where: {
            OR: [
                { id: { contains: text, mode: 'insensitive' } },
                { customerName: { contains: text, mode: 'insensitive' } },
            ],
        },
        take: 5,
        orderBy: { date: 'desc' },
        include: { items: { include: { product: true } } },
    });
    
    if (invoices.length === 0) {
        await sendMessage(chatId, `🔍 لم يتم العثور على نتائج لـ "${text}"`, [
            [btn('📅 آخر 5 فواتير', 'inv:recent')],
            navRow({ home: true }),
        ]);
        return;
    }
    
    await sendInvoiceList(chatId, invoices);
}

async function handleInvoiceCallback(chatId: number, value: string): Promise<void> {
    if (value === 'recent') {
        const prisma = getPrisma();
        const invoices = await prisma.invoice.findMany({
            take: 5,
            orderBy: { date: 'desc' },
            include: { items: { include: { product: true } } },
        });
        await sendInvoiceList(chatId, invoices);
    } else if (value.startsWith('view:')) {
        await sendInvoiceDetail(chatId, value.substring(5));
    } else if (value.startsWith('pdf:')) {
        await sendInvoicePdf(chatId, value.substring(4));
    }
}

async function sendInvoiceList(chatId: number, invoices: any[]): Promise<void> {
    const lines = invoices.map((inv, i) => {
        const shortId = inv.id.slice(-4).toUpperCase();
        const customer = inv.customerName || 'بدون عميل';
        const total = Number(inv.totalAmount).toLocaleString('ar-EG');
        const date = new Date(inv.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
        return `${i + 1}. #${shortId} — ${customer} — ${total} ج.م — ${date}`;
    });
    
    const buttons: InlineKeyboard = invoices.map(inv => {
        const shortId = inv.id.slice(-4).toUpperCase();
        return [btn(`#${shortId}`, `inv:view:${inv.id}`)];
    });
    
    // Split into rows of 3
    const mergedButtons: InlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 3) {
        mergedButtons.push(buttons.slice(i, i + 3).map(row => row[0]));
    }
    mergedButtons.push(navRow({ home: true }));
    
    await sendMessage(chatId, `📋 <b>الفواتير:</b>\n\n${lines.join('\n')}`, mergedButtons);
}

async function sendInvoiceDetail(chatId: number, invoiceId: string): Promise<void> {
    const prisma = getPrisma();
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            items: { include: { product: true } },
            user: { select: { name: true, username: true } },
        },
    });
    
    if (!invoice) {
        await sendMessage(chatId, '⚠️ الفاتورة غير موجودة', [navRow({ home: true })]);
        return;
    }
    
    const shortId = invoice.id.slice(-4).toUpperCase();
    const date = new Date(invoice.date).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    
    const itemLines = invoice.items.map((item, i) =>
        `${i + 1}. ${item.product.name} × ${Number(item.quantity)} — ${Number(item.subtotal).toLocaleString('ar-EG')} ج.م`
    ).join('\n');
    
    let payMethodAr = 'آجل';
    if (invoice.paymentMethod === 'CASH') payMethodAr = 'كاش';
    else if (invoice.paymentMethod === 'INSTAPAY') payMethodAr = 'انستاباي';
    const seller = invoice.user?.name || invoice.user?.username || 'N/A';
    
    let text = `📄 <b>فاتورة #${shortId}</b>\n\n`;
    text += `📅 ${date}\n`;
    text += `👤 العميل: ${invoice.customerName || 'بدون عميل'}\n`;
    text += `👷 البائع: ${seller}\n`;
    text += `\n━━━━━━━━━━━━━━━━━━━\n`;
    text += `${itemLines}\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 الإجمالي: <b>${Number(invoice.totalAmount).toLocaleString('ar-EG')} ج.م</b>\n`;
    text += `💵 المدفوع: ${Number(invoice.amountPaid).toLocaleString('ar-EG')} ج.م\n`;
    text += `💳 طريقة الدفع: ${payMethodAr}\n`;
    
    if (Number(invoice.currentBalance) > 0) {
        text += `📊 الرصيد: ${Number(invoice.currentBalance).toLocaleString('ar-EG')} ج.م\n`;
    }
    
    await sendMessage(chatId, text, [
        [btn('📎 تحميل PDF', `inv:pdf:${invoiceId}`)],
        navRow({ back: 'inv:recent', home: true }),
    ]);
}

async function sendInvoicePdf(chatId: number, invoiceId: string): Promise<void> {
    try {
        await sendMessage(chatId, '⏳ جاري إنشاء ملف PDF...');
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
        if (!appUrl) {
            await sendMessage(chatId, '⚠️ لم يتم تكوين عنوان التطبيق (APP_URL)');
            return;
        }
        
        const protocol = appUrl.startsWith('http') ? '' : 'https://';
        const pdfUrl = `${protocol}${appUrl}/api/invoices/${invoiceId}/pdf`;
        const response = await fetch(pdfUrl);
        
        if (!response.ok) {
            await sendMessage(chatId, '❌ فشل إنشاء ملف PDF');
            return;
        }
        
        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        const shortId = invoiceId.slice(-4).toUpperCase();
        await sendDocument(chatId, pdfBuffer, `invoice-${shortId}.pdf`, `📎 فاتورة #${shortId}`);
    } catch (error) {
        console.error('PDF send error:', error);
        await sendMessage(chatId, '❌ حدث خطأ أثناء إنشاء ملف PDF');
    }
}

// ─── FLOW 3: Stock Query ────────────────────────────────────────────────────

async function startStockQuery(chatId: number): Promise<void> {
    await sendMessage(
        chatId,
        '📦 <b>المخزون</b>',
        [
            [btn('📊 ملخص عام', 'stk:summary'), btn('🔍 بحث', 'stk:search')],
            [btn('📂 حسب الفئة', 'stk:by_cat'), btn('⚠️ نفاد', 'stk:low')],
            navRow({ home: true }),
        ]
    );
}

async function handleStockCallback(chatId: number, value: string): Promise<void> {
    if (value === 'summary') {
        await sendStockSummary(chatId);
    } else if (value === 'search') {
        startStockSearchFlow(chatId);
        await sendMessage(chatId, '🔍 اكتب اسم المنتج للبحث:', [
            navRow({ back: 'menu:stock', cancel: true }),
        ]);
    } else if (value === 'by_cat') {
        await sendStockByCategory(chatId);
    } else if (value === 'low') {
        await sendLowStock(chatId);
    } else if (value.startsWith('prod:')) {
        await sendProductStock(chatId, value.substring(5));
    }
}

async function handleStockTextInput(chatId: number, text: string): Promise<void> {
    const prisma = getPrisma();
    const location = await prisma.location.findFirst();
    
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: text, mode: 'insensitive' } },
                { sku: { contains: text, mode: 'insensitive' } },
            ],
        },
        take: 5,
        include: { category: true },
    });
    
    if (products.length === 0) {
        await sendMessage(chatId, `🔍 لم يتم العثور على "${text}"`, [
            navRow({ back: 'menu:stock', home: true }),
        ]);
        return;
    }
    
    const inventories = location ? await prisma.inventory.findMany({
        where: {
            locationId: location.id,
            productId: { in: products.map(p => p.id) },
        },
    }) : [];
    const stockMap = new Map(inventories.map(inv => [inv.productId, Number(inv.quantity)]));
    
    const buttons: InlineKeyboard = products.map(p => {
        const stock = stockMap.get(p.id) || 0;
        let emoji = '🟢';
        if (stock <= 0) emoji = '🔴';
        else if (stock < 5) emoji = '🟡';
        return [btn(`${emoji} ${p.name} (${stock})`, `stk:prod:${p.id}`)];
    });
    buttons.push(navRow({ back: 'menu:stock', home: true }));
    
    await sendMessage(chatId, `🔍 <b>نتائج البحث:</b>`, buttons);
}

async function sendStockSummary(chatId: number): Promise<void> {
    const prisma = getPrisma();
    
    const productCount = await prisma.product.count();
    const inventories = await prisma.inventory.findMany({
        include: { product: true },
    });
    
    const totalUnits = inventories.reduce((sum, inv) => sum + Number(inv.quantity), 0);
    const totalValue = inventories.reduce((sum, inv) => sum + (Number(inv.quantity) * Number(inv.product.baseSellingPrice)), 0);
    
    // Top 5 by stock
    const stockByProduct = new Map<string, { name: string; qty: number }>();
    for (const inv of inventories) {
        const existing = stockByProduct.get(inv.productId);
        if (existing) {
            existing.qty += Number(inv.quantity);
        } else {
            stockByProduct.set(inv.productId, { name: inv.product.name, qty: Number(inv.quantity) });
        }
    }
    const top5 = [...stockByProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const top5Text = top5.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} قطعة`).join('\n');
    
    let text = `📦 <b>ملخص المخزون:</b>\n\n`;
    text += `📊 إجمالي الأصناف: <b>${productCount}</b>\n`;
    text += `📦 إجمالي القطع: <b>${totalUnits.toLocaleString('ar-EG')}</b>\n`;
    text += `💰 قيمة المخزون (بيع): <b>${totalValue.toLocaleString('ar-EG')} ج.م</b>\n`;
    text += `\n<b>أعلى 5 أصناف:</b>\n${top5Text}`;
    
    await sendMessage(chatId, text, [
        [btn('🔍 بحث', 'stk:search'), btn('⚠️ نفاد', 'stk:low')],
        navRow({ back: 'menu:stock', home: true }),
    ]);
}

async function sendLowStock(chatId: number): Promise<void> {
    const prisma = getPrisma();
    const location = await prisma.location.findFirst();
    if (!location) {
        await sendMessage(chatId, '⚠️ لا يوجد مستودع', [navRow({ home: true })]);
        return;
    }
    
    const lowItems = await prisma.inventory.findMany({
        where: {
            locationId: location.id,
            quantity: { lt: 5 },
        },
        include: { product: true },
        orderBy: { quantity: 'asc' },
        take: 15,
    });
    
    if (lowItems.length === 0) {
        await sendMessage(chatId, '✅ لا توجد أصناف قاربت على النفاد!', [
            navRow({ back: 'menu:stock', home: true }),
        ]);
        return;
    }
    
    const lines = lowItems.map(inv => {
        const qty = Number(inv.quantity);
        let emoji = '🟡';
        if (qty <= 1) emoji = '🔴';
        else if (qty <= 3) emoji = '🟠';
        return `${emoji} ${inv.product.name} — ${qty} قطعة`;
    });
    
    await sendMessage(
        chatId,
        `⚠️ <b>أصناف قاربت على النفاد (أقل من 5):</b>\n\n${lines.join('\n')}`,
        [navRow({ back: 'menu:stock', home: true })]
    );
}

async function sendStockByCategory(chatId: number): Promise<void> {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
        include: {
            products: {
                include: {
                    inventoryItems: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    });
    
    const lines = categories.map(cat => {
        const totalStock = cat.products.reduce((sum, p) => 
            sum + p.inventoryItems.reduce((s, inv) => s + Number(inv.quantity), 0), 0
        );
        return `📁 ${cat.name}: ${cat.products.length} أصناف — ${totalStock} قطعة`;
    });
    
    await sendMessage(
        chatId,
        `📂 <b>المخزون حسب الفئة:</b>\n\n${lines.join('\n')}`,
        [navRow({ back: 'menu:stock', home: true })]
    );
}

async function sendProductStock(chatId: number, productId: string): Promise<void> {
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            category: true,
            inventoryItems: {
                include: { location: true },
            },
        },
    });
    
    if (!product) {
        await sendMessage(chatId, '⚠️ المنتج غير موجود', [navRow({ home: true })]);
        return;
    }
    
    const totalStock = product.inventoryItems.reduce((sum, inv) => sum + Number(inv.quantity), 0);
    const locationBreakdown = product.inventoryItems.map(inv =>
        `  • ${inv.location.name}: ${Number(inv.quantity)}`
    ).join('\n');
    
    let text = `📦 <b>${product.name}</b>\n\n`;
    text += `المخزون: <b>${totalStock} قطعة</b>\n`;
    text += `سعر البيع: ${Number(product.baseSellingPrice).toLocaleString('ar-EG')} ج.م\n`;
    text += `الفئة: ${product.category.name}\n`;
    text += `الكود: ${product.sku}\n`;
    if (locationBreakdown) {
        text += `\n📍 التوزيع:\n${locationBreakdown}`;
    }
    
    await sendMessage(chatId, text, [
        [btn('🛒 بيع هذا الصنف', `sale:prod:${productId}`)],
        navRow({ back: 'menu:stock', home: true }),
    ]);
}

// ─── FLOW 4: Daily Summary ──────────────────────────────────────────────────

async function sendTodaySummary(chatId: number): Promise<void> {
    const prisma = getPrisma();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const invoices = await prisma.invoice.findMany({
        where: { date: { gte: todayStart } },
        include: { items: { include: { product: true } } },
    });
    
    const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalItems = invoices.reduce((sum, inv) => 
        sum + inv.items.reduce((s, item) => s + Number(item.quantity), 0), 0
    );
    
    // By payment method
    const byMethod: Record<string, { count: number; total: number }> = {};
    for (const inv of invoices) {
        const method = inv.paymentMethod;
        if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 };
        byMethod[method].count++;
        byMethod[method].total += Number(inv.totalAmount);
    }
    
    const methodAr: Record<string, string> = { CASH: '💵 كاش', INSTAPAY: '📱 انستاباي', CREDIT: '💳 آجل' };
    const methodLines = Object.entries(byMethod).map(([m, d]) =>
        `${methodAr[m] || m}: ${d.total.toLocaleString('ar-EG')} ج.م (${d.count} فواتير)`
    ).join('\n');
    
    // Top products
    const productSales = new Map<string, { name: string; qty: number; total: number }>();
    for (const inv of invoices) {
        for (const item of inv.items) {
            const existing = productSales.get(item.productId);
            const qty = Number(item.quantity);
            const subtotal = Number(item.subtotal);
            if (existing) {
                existing.qty += qty;
                existing.total += subtotal;
            } else {
                productSales.set(item.productId, { name: item.product.name, qty, total: subtotal });
            }
        }
    }
    const topProducts = [...productSales.values()].sort((a, b) => b.total - a.total).slice(0, 3);
    const topText = topProducts.map((p, i) =>
        `${i + 1}. ${p.name} × ${p.qty} = ${p.total.toLocaleString('ar-EG')} ج.م`
    ).join('\n');
    
    const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    
    let text = `📊 <b>ملخص اليوم — ${dateStr}</b>\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 المبيعات: <b>${totalSales.toLocaleString('ar-EG')} ج.م</b>\n`;
    text += `🧾 عدد الفواتير: ${invoices.length}\n`;
    text += `📦 عدد الأصناف المباعة: ${totalItems}\n`;
    text += `\n━━━━ حسب طريقة الدفع ━━━━\n${methodLines}\n`;
    if (topText) {
        text += `\n━━━━ أعلى 3 أصناف ━━━━\n${topText}`;
    }
    
    await sendMessage(chatId, text, [
        navRow({ home: true }),
    ]);
}

async function handleTodayCallback(chatId: number, value: string): Promise<void> {
    if (value === 'refresh') {
        await sendTodaySummary(chatId);
    }
}
