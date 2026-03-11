"use client";

import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RefreshCw, Search, Key } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function UserManagement() {
    const { t } = useLanguage();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [newPassword, setNewPassword] = useState("");
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedUser || !newPassword) return;
        setResetting(true);
        try {
            const res = await fetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword })
            });
            const data = await res.json();
            if (data.success) {
                alert("Password reset successfully");
                setSelectedUser(null);
                setNewPassword("");
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            alert("Unexpected error");
        } finally {
            setResetting(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 max-w-sm">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t("search_players")}
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("code")}</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="text-right">{t("actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium text-blue-600">{user.code}</TableCell>
                                    <TableCell>{user.name || "N/A"}</TableCell>
                                    <TableCell>
                                        <span className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800">
                                            {user.role}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedUser(user)}
                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                        >
                                            <Key className="h-4 w-4 mr-1" />
                                            {t("reset_password") || "Reset Pass"}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>New Password for {selectedUser?.code}</Label>
                            <Input
                                type="text"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min 4 characters"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
                        <Button
                            onClick={handleResetPassword}
                            disabled={resetting || newPassword.length < 4}
                        >
                            {resetting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirm Reset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
