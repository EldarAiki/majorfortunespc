"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AgentView from "./agent-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, RefreshCw, Layers, Users, Power } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { ManageUsersModal } from "./manage-users-modal";

export default function AdminView({ user, games, subPlayers, clubFullByClubId = {}, managers = [] }) {
    const { t } = useLanguage();
    const [uploading, setUploading] = useState(false);
    const [cycleLoading, setCycleLoading] = useState(false);
    const [manageUsersOpen, setManageUsersOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [promoteFilter, setPromoteFilter] = useState("");
    const [promoting, setPromoting] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState("");
    const [revokeFilter, setRevokeFilter] = useState("");
    const [revoking, setRevoking] = useState(false);
    const [createManagerOpen, setCreateManagerOpen] = useState(false);
    const [creatingManager, setCreatingManager] = useState(false);
    const [newManagerForm, setNewManagerForm] = useState({
        code: "",
        username: "",
        password: "",
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const onFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                alert(t("upload_success") + " " + data.message);
                window.location.reload();
            } else {
                alert(t("upload_failed") + ": " + data.error);
            }
        } catch (err) {
            alert(t("upload_failed") + ": " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleCloseCycle = async () => {
        if (!confirm("Are you sure you want to close the current cycle? Information will be archived.")) return;

        setCycleLoading(true);
        try {
            const res = await fetch("/api/admin/cycle", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                window.location.reload();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            alert("Unexpected error.");
        } finally {
            setCycleLoading(false);
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (Array.isArray(data)) {
                setUsers(data);
            } else {
                alert("Failed to load users");
            }
        } catch (e) {
            alert("Failed to load users");
        } finally {
            setUsersLoading(false);
        }
    };

    const promotableUsers = useMemo(() => {
        const needle = promoteFilter.trim().toLowerCase();
        return users
            .filter((u) => u.role !== "MANAGER" && u.role !== "ADMIN")
            .filter((u) => {
                if (!needle) return true;
                return (
                    u.code?.toLowerCase().includes(needle) ||
                    u.name?.toLowerCase().includes(needle) ||
                    u.role?.toLowerCase().includes(needle)
                );
            });
    }, [users, promoteFilter]);

    const managerUsers = useMemo(() => {
        const needle = revokeFilter.trim().toLowerCase();
        return users
            .filter((u) => u.role === "MANAGER")
            .filter((u) => {
                if (!needle) return true;
                return (
                    u.code?.toLowerCase().includes(needle) ||
                    u.name?.toLowerCase().includes(needle)
                );
            });
    }, [users, revokeFilter]);

    const handlePromoteToManager = async () => {
        if (!selectedUserId) return;
        setPromoting(true);
        try {
            const res = await fetch("/api/admin/manager-users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "promote", userId: selectedUserId }),
            });
            const data = await res.json();
            if (data.success) {
                alert(t("manager_promoted_success"));
                setSelectedUserId("");
                await fetchUsers();
            } else {
                alert("Error: " + (data.error || t("promotion_failed")));
            }
        } catch (e) {
            alert(t("promote_unexpected_error"));
        } finally {
            setPromoting(false);
        }
    };

    const handleCreateManager = async () => {
        if (!newManagerForm.code || !newManagerForm.username || newManagerForm.password.length < 4) return;
        setCreatingManager(true);
        try {
            const res = await fetch("/api/admin/manager-users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    code: newManagerForm.code.trim(),
                    name: newManagerForm.username.trim(),
                    password: newManagerForm.password,
                }),
            });
            const data = await res.json();
            if (data.success) {
                alert(t("manager_created_success"));
                setCreateManagerOpen(false);
                setNewManagerForm({ code: "", username: "", password: "" });
                await fetchUsers();
            } else {
                alert("Error: " + (data.error || t("creation_failed")));
            }
        } catch (e) {
            alert(t("create_manager_unexpected_error"));
        } finally {
            setCreatingManager(false);
        }
    };

    const handleRevokeManager = async () => {
        if (!selectedManagerId) return;
        setRevoking(true);
        try {
            const res = await fetch("/api/admin/manager-users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "revoke", userId: selectedManagerId }),
            });
            const data = await res.json();
            if (data.success) {
                alert(t("manager_revoked_success"));
                setSelectedManagerId("");
                await fetchUsers();
            } else {
                alert("Error: " + (data.error || t("revoke_failed")));
            }
        } catch (e) {
            alert(t("revoke_unexpected_error"));
        } finally {
            setRevoking(false);
        }
    };

    return (
        <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
                <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
                <TabsTrigger value="admin">{t("admin_panel")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
                <AgentView
                    user={user}
                    games={games}
                    subPlayers={subPlayers}
                    clubFullByClubId={clubFullByClubId}
                    managers={managers}
                />
            </TabsContent>

            <TabsContent value="admin" className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold tracking-tight">{t("admin_panel")}</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle>{t("data_upload")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="picture">{t("report_file")}</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="picture"
                                        type="file"
                                        accept=".xlsx"
                                        onChange={onFileChange}
                                        disabled={uploading}
                                    />
                                    <Button disabled={uploading} variant="secondary">
                                        {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md">
                        <CardHeader className="flex flex-row items-center gap-2">
                            <Layers className="h-5 w-5 text-blue-600" />
                            <CardTitle>{t("cycle_mgmt")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                                <div>
                                    <p className="text-sm font-medium">{t("current_cycle")}</p>
                                    <p className="text-xs text-muted-foreground">Status: OPEN</p>
                                </div>
                                <Button
                                    onClick={handleCloseCycle}
                                    disabled={cycleLoading}
                                    variant="destructive"
                                    size="sm"
                                    className="gap-2"
                                >
                                    <Power className="h-4 w-4" />
                                    {t("close_cycle")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md">
                        <CardHeader className="flex flex-row items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            <CardTitle>{t("manage_users")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Reset passwords, adjust roles, or view individual user activity logs.
                            </p>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setManageUsersOpen(true)}
                            >
                                {t("manage_users")}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md">
                        <CardHeader className="flex flex-row items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            <CardTitle>{t("manager_assignment")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="manager-promote-user">{t("promote_existing_user_to_manager")}</Label>
                                <Input
                                    id="manager-promote-user"
                                    placeholder={t("filter_users_for_promotion_placeholder")}
                                    value={promoteFilter}
                                    onChange={(e) => setPromoteFilter(e.target.value)}
                                    disabled={usersLoading || promoting}
                                />
                                <div className="max-h-36 overflow-y-auto rounded-md border">
                                    {promotableUsers.map((u) => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 ${selectedUserId === u.id ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                                            onClick={() => setSelectedUserId(u.id)}
                                        >
                                            {u.code} - {u.name || "N/A"} ({u.role})
                                        </button>
                                    ))}
                                    {!usersLoading && promotableUsers.length === 0 ? (
                                        <p className="px-3 py-2 text-sm text-muted-foreground">{t("no_matching_users")}</p>
                                    ) : null}
                                </div>
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={handlePromoteToManager}
                                    disabled={!selectedUserId || promoting || usersLoading}
                                >
                                    {promoting ? <RefreshCw className="h-4 w-4 animate-spin" /> : t("promote_to_manager")}
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="manager-revoke-user">{t("revoke_manager_role_set_super_agent")}</Label>
                                <Input
                                    id="manager-revoke-user"
                                    placeholder={t("filter_managers_for_revoke_placeholder")}
                                    value={revokeFilter}
                                    onChange={(e) => setRevokeFilter(e.target.value)}
                                    disabled={usersLoading || revoking}
                                />
                                <div className="max-h-36 overflow-y-auto rounded-md border">
                                    {managerUsers.map((u) => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 ${selectedManagerId === u.id ? "bg-orange-50 dark:bg-orange-950/40" : ""}`}
                                            onClick={() => setSelectedManagerId(u.id)}
                                        >
                                            {u.code} - {u.name || "N/A"} ({u.role})
                                        </button>
                                    ))}
                                    {!usersLoading && managerUsers.length === 0 ? (
                                        <p className="px-3 py-2 text-sm text-muted-foreground">{t("no_matching_managers")}</p>
                                    ) : null}
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleRevokeManager}
                                    disabled={!selectedManagerId || revoking || usersLoading}
                                >
                                    {revoking ? <RefreshCw className="h-4 w-4 animate-spin" /> : t("revoke_manager_role")}
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label>{t("create_dedicated_manager_account")}</Label>
                                <Button
                                    className="w-full"
                                    onClick={() => setCreateManagerOpen(true)}
                                    disabled={creatingManager}
                                >
                                    {t("create_new_manager_user")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <ManageUsersModal
                open={manageUsersOpen}
                onOpenChange={setManageUsersOpen}
            />
            <Dialog open={createManagerOpen} onOpenChange={setCreateManagerOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("create_new_manager_user")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="manager-user-code">{t("user_code")}</Label>
                            <Input
                                id="manager-user-code"
                                value={newManagerForm.code}
                                onChange={(e) => setNewManagerForm((prev) => ({ ...prev, code: e.target.value }))}
                                placeholder={t("manager_code_placeholder")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="manager-user-name">{t("username")}</Label>
                            <Input
                                id="manager-user-name"
                                value={newManagerForm.username}
                                onChange={(e) => setNewManagerForm((prev) => ({ ...prev, username: e.target.value }))}
                                placeholder={t("manager_username_placeholder")}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="manager-user-password">{t("password")}</Label>
                            <Input
                                id="manager-user-password"
                                type="password"
                                value={newManagerForm.password}
                                onChange={(e) => setNewManagerForm((prev) => ({ ...prev, password: e.target.value }))}
                                placeholder={t("minimum_4_characters")}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateManagerOpen(false)}>{t("cancel")}</Button>
                        <Button
                            onClick={handleCreateManager}
                            disabled={creatingManager || !newManagerForm.code || !newManagerForm.username || newManagerForm.password.length < 4}
                        >
                            {creatingManager ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t("create_manager")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Tabs>
    );
}
