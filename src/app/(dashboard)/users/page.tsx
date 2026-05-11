'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUsers, deleteUser, createUser, updateUser } from '@/app/actions/users';
import { getDefaultPermissions, ALL_PERMISSIONS } from '@/lib/permissions';
import { UserPlus, Trash2, Shield, Eye, Phone, MapPin, Settings } from 'lucide-react';
import Link from 'next/link';

interface User {
    id: string;
    username: string;
    name: string | null;
    role: string;
    phone: string | null;
    address: string | null;
    permissions: string[];
    createdAt: Date;
}

const ROLE_COLORS: Record<string, string> = {
    ROOT: 'bg-purple-100 text-purple-700 border-purple-200',
    ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
    ACCOUNTANT: 'bg-green-100 text-green-700 border-green-200',
    SALESPERSON: 'bg-orange-100 text-orange-700 border-orange-200',
    READ_ONLY: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [selectedRole, setSelectedRole] = useState('SALESPERSON');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [useCustomPermissions, setUseCustomPermissions] = useState(false);
    const [error, setError] = useState('');

    const fetchUsers = useCallback(async (showLoading = false) => {
        if (showLoading) setIsLoading(true);
        const data = await getUsers();
        setUsers(data as User[]);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchUsers(false);
    }, [fetchUsers]);

    // permissions derived directly when needed

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            const res = await deleteUser(id);
            if (res.success) {
                fetchUsers(true);
            } else {
                alert(res.error);
            }
        }
    };

    const handleDeleteClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id) handleDelete(id);
    }, [fetchUsers]);

    const openCreateModal = useCallback(() => {
        setEditingUser(null);
        setSelectedRole('SALESPERSON');
        setSelectedPermissions(getDefaultPermissions('SALESPERSON'));
        setUseCustomPermissions(false);
        setError('');
        setIsModalOpen(true);
    }, []);

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setSelectedRole(user.role);
        setSelectedPermissions(user.permissions.length > 0 ? user.permissions : getDefaultPermissions(user.role));
        setUseCustomPermissions(user.permissions.length > 0);
        setError('');
        setIsModalOpen(true);
    };

    const handleEditClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const id = e.currentTarget.dataset.id;
        if (id) {
            const found = users.find(u => u.id === id);
            if (found) openEditModal(found);
        }
    }, [users]);

    const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        const formData = new FormData(e.currentTarget);

        // Add permissions to form data
        formData.set('permissions', JSON.stringify(useCustomPermissions ? selectedPermissions : []));

        if (editingUser) {
            const res = await updateUser(editingUser.id, formData);
            if (res.success) {
                setIsModalOpen(false);
                fetchUsers();
            } else {
                setError(res.error || 'Failed to update user');
            }
        } else {
            const res = await createUser(formData);
            if (res.success) {
                setIsModalOpen(false);
                fetchUsers();
            } else {
                setError(res.error || 'Failed to create user');
            }
        }
    }, [editingUser, fetchUsers, useCustomPermissions, selectedPermissions]);

    const togglePermission = (key: string) => {
        setSelectedPermissions(prev =>
            prev.includes(key)
                ? prev.filter(p => p !== key)
                : [...prev, key]
        );
    };

    const handleRoleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRole(e.target.value), []);
    const handleCustomPermissionsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setUseCustomPermissions(e.target.checked), []);
    const handleTogglePermissionClick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const key = e.target.dataset.key;
        if (key) togglePermission(key);
    }, []);
    const handleCloseModalClick = useCallback(() => setIsModalOpen(false), []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Team Management</h1>
                    <p className="text-muted-foreground">Manage employees, salespersons, and accountants.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                    <UserPlus size={20} />
                    Add Member
                </button>
            </div>

            {/* Role Legend */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(ROLE_COLORS).map(([role, color]) => (
                    <span key={role} className={`text-xs px-2 py-1 rounded-full border ${color}`}>
                        {role}
                    </span>
                ))}
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-secondary/50">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-sm">Employee</th>
                            <th className="px-6 py-4 font-semibold text-sm">Contact</th>
                            <th className="px-6 py-4 font-semibold text-sm">Role</th>
                            <th className="px-6 py-4 font-semibold text-sm">Joined</th>
                            <th className="px-6 py-4 font-semibold text-sm text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td>
                            </tr>
                        ) : users.map((user) => (
                            <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${user.role === 'ROOT' ? 'bg-purple-500' :
                                            user.role === 'ADMIN' ? 'bg-blue-500' :
                                                user.role === 'ACCOUNTANT' ? 'bg-green-500' :
                                                    user.role === 'SALESPERSON' ? 'bg-orange-500' :
                                                        'bg-gray-500'
                                            }`}>
                                            {(user.name || user.username)[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium">{user.name || 'Anonymous'}</div>
                                            <div className="text-xs text-muted-foreground">@{user.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="space-y-1">
                                        {user.phone && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Phone size={12} /> {user.phone}
                                            </div>
                                        )}
                                        {user.address && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <MapPin size={12} /> {user.address}
                                            </div>
                                        )}
                                        {!user.phone && !user.address && (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[user.role] || ROLE_COLORS.READ_ONLY}`}>
                                        <Shield size={12} />
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-muted-foreground">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link prefetch={false}
                                            href={`/logs?user=${user.id}`}
                                            className="p-2 text-muted-foreground hover:text-blue-500 transition-colors"
                                            title="View Activity"
                                        >
                                            <Eye size={18} />
                                        </Link>
                                        {user.role !== 'ROOT' && (
                                            <>
                                                <button
                                                    data-id={user.id}
                                                    onClick={handleEditClick}
                                                    className="p-2 text-muted-foreground hover:text-primary transition-colors"
                                                    title="Edit"
                                                >
                                                    <Settings size={18} />
                                                </button>
                                                <button
                                                    data-id={user.id}
                                                    onClick={handleDeleteClick}
                                                    className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-2xl shadow-xl border border-border">
                        <h2 className="text-xl font-bold mb-4">
                            {editingUser ? 'Edit Team Member' : 'Add Team Member'}
                        </h2>
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Full Name</label>
                                    <input
                                        name="name"
                                        type="text"
                                        defaultValue={editingUser?.name || ''}
                                        className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20"
                                        required
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Username</label>
                                    <input
                                        name="username"
                                        type="text"
                                        defaultValue={editingUser?.username || ''}
                                        className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20"
                                        required
                                        placeholder="johndoe"
                                        disabled={!!editingUser}
                                    />
                                </div>
                            </div>

                            {!editingUser && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email Address</label>
                                        <input name="email" type="email" className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20" required placeholder="john@coffee.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Password</label>
                                        <input name="password" type="password" className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20" required placeholder="••••••••" minLength={6} />
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Phone</label>
                                    <input
                                        name="phone"
                                        type="tel"
                                        defaultValue={editingUser?.phone || ''}
                                        className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20"
                                        placeholder="01xxxxxxxxx"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Address</label>
                                    <input
                                        name="address"
                                        type="text"
                                        defaultValue={editingUser?.address || ''}
                                        className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20"
                                        placeholder="Cairo, Egypt"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role</label>
                                <select
                                    name="role"
                                    value={selectedRole}
                                    onChange={handleRoleChange}
                                    className="w-full bg-secondary/50 border border-border rounded-lg p-2.5 outline-none focus:ring-2 ring-primary/20"
                                >
                                    <option value="SALESPERSON">Salesperson (Carrier)</option>
                                    <option value="ACCOUNTANT">Accountant</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="READ_ONLY">Read Only</option>
                                </select>
                                <p className="text-[10px] text-muted-foreground italic">ROOT role can only be assigned via database.</p>
                            </div>

                            {/* Permissions Section */}
                            <div className="space-y-3 p-4 bg-secondary/30 rounded-xl border border-border">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold">Page Permissions</label>
                                    <label className="flex items-center gap-2 text-xs">
                                        <input
                                            type="checkbox"
                                            checked={useCustomPermissions}
                                            onChange={handleCustomPermissionsChange}
                                            className="rounded"
                                        />
                                        Custom permissions
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {ALL_PERMISSIONS.map(perm => (
                                        <label
                                            key={perm.key}
                                            className={`flex items-center gap-2 text-sm p-2 rounded-lg cursor-pointer transition-colors ${selectedPermissions.includes(perm.key)
                                                ? 'bg-primary/10 text-primary'
                                                : 'bg-secondary/50 text-muted-foreground'
                                                } ${!useCustomPermissions ? 'opacity-60' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedPermissions.includes(perm.key)}
                                                data-key={perm.key}
                                                onChange={handleTogglePermissionClick}
                                                disabled={!useCustomPermissions}
                                                className="rounded"
                                            />
                                            {perm.label}
                                        </label>
                                    ))}
                                </div>
                                {!useCustomPermissions && (
                                    <p className="text-[10px] text-muted-foreground">Using default permissions for {selectedRole} role.</p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={handleCloseModalClick} className="flex-1 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
                                    {editingUser ? 'Update' : 'Create'} User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
