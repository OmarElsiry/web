'use client';

import { useState, useEffect } from 'react';
import { getUsers, deleteUser, createUser } from '@/app/actions/users';
import { UserPlus, Trash2, Shield, User as UserIcon, Mail } from 'lucide-react';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        const data = await getUsers();
        setUsers(data);
        setIsLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            const res = await deleteUser(id);
            if (res.success) {
                fetchUsers();
            } else {
                alert(res.error);
            }
        }
    };

    const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        const formData = new FormData(e.currentTarget);
        const res = await createUser(formData);

        if (res.success) {
            setIsModalOpen(false);
            fetchUsers();
        } else {
            setError(res.error || 'Failed to create user');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Team Management</h1>
                    <p className="text-muted-foreground">Manage your staff and their access levels.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                    <UserPlus size={20} />
                    Add Member
                </button>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-secondary/50">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-sm">User</th>
                            <th className="px-6 py-4 font-semibold text-sm">Role</th>
                            <th className="px-6 py-4 font-semibold text-sm">Joined</th>
                            <th className="px-6 py-4 font-semibold text-sm text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading...</td>
                            </tr>
                        ) : users.map((user) => (
                            <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <UserIcon size={20} />
                                        </div>
                                        <div>
                                            <div className="font-medium">{user.name || 'Anonymous'}</div>
                                            <div className="text-xs text-muted-foreground">@{user.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'ROOT' ? 'bg-purple-100 text-purple-700' :
                                        user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                        <Shield size={12} />
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-muted-foreground">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {user.role !== 'ROOT' && (
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md p-6 rounded-2xl shadow-xl border border-border slide-in-from-bottom-4 animate-in duration-300">
                        <h2 className="text-xl font-bold mb-4">Add Team Member</h2>
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Full Name</label>
                                <input name="name" type="text" className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20" required placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Username</label>
                                <input name="username" type="text" className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20" required placeholder="johndoe" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email Address</label>
                                <input name="email" type="email" className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20" required placeholder="john@coffee.com" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password</label>
                                <input name="password" type="password" className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20" required placeholder="••••••••" minLength={6} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role</label>
                                <select name="role" className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20" defaultValue="READ_ONLY">
                                    <option value="ADMIN">Admin</option>
                                    <option value="READ_ONLY">Read Only</option>
                                </select>
                                <p className="text-[10px] text-muted-foreground mt-1 italic">Note: ROOT role can only be assigned via database for security.</p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity">Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
