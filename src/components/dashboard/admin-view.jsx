"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AgentView from "./agent-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, RefreshCw, Layers, Users, Power } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useState } from "react";
import { ManageUsersModal } from "./manage-users-modal";

export default function AdminView({ user, games, subPlayers, clubFullByClubId = {}, managers = [] }) {
    const { t } = useLanguage();
    const [uploading, setUploading] = useState(false);
    const [cycleLoading, setCycleLoading] = useState(false);
    const [manageUsersOpen, setManageUsersOpen] = useState(false);

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

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                </div>
            </TabsContent>

            <ManageUsersModal
                open={manageUsersOpen}
                onOpenChange={setManageUsersOpen}
            />
        </Tabs>
    );
}
