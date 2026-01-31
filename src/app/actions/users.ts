'use server';

import getPrisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
    const prisma = getPrisma();
    return prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    });
}

export async function deleteUser(id: string) {
    const prisma = getPrisma();
    const supabase = await createClient();

    // 1. Delete from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) {
        return { error: authError.message };
    }

    // 2. Delete from public table
    await prisma.user.delete({
        where: { id }
    });

    revalidatePath('/users');
    return { success: true };
}

export async function createUser(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;
    const role = formData.get('role') as any;
    const name = formData.get('name') as string;

    const supabase = await createClient();

    // 1. Create in Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (authError) {
        return { error: authError.message };
    }

    // 2. Create in public table
    const prisma = getPrisma();
    await prisma.user.create({
        data: {
            id: user.id,
            username,
            password: 'EXTERNAL_AUTH', // Password is managed by Supabase Auth
            role,
            name
        }
    });

    revalidatePath('/users');
    return { success: true };
}
