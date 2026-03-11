"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, Eye, ChevronRight, Settings2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DetailsModal({ userId, isOpen, onClose, currentUser }) {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [history, setHistory] = useState([]); // Stack for recursive navigation
    const [selectedForRakeback, setSelectedForRakeback] = useState(null);
    const [newRakeback, setNewRakeback] = useState("");
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            fetchDetails(userId, true);
        } else if (!isOpen) {
            setData(null);
            setHistory([]);
        }
    }, [isOpen, userId]);

    const fetchDetails = async (id, isNewStack = false) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/users/${id}/details`);
            const details = await res.json();
            setData(details);
            if (isNewStack) {
                setHistory([{ id, code: details.user.code }]);
            }
        } catch (error) {
            console.error("Error fetching details:", error);
        } finally {
            setLoading(false);
        }
    };

    const navigateTo = (user) => {
        setHistory([...history, { id: user.id, code: user.code }]);
        fetchDetails(user.id);
    };

    const goBack = (index) => {
        const newHistory = history.slice(0, index + 1);
        setHistory(newHistory);
        fetchDetails(newHistory[newHistory.length - 1].id);
    };

    const handleUpdateRakeback = async () => {
        if (!selectedForRakeback || newRakeback === "") return;
        setUpdating(true);
        try {
            const res = await fetch("/api/admin/users/rakeback", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedForRakeback.id,
                    rakeback: parseFloat(newRakeback),
                }),
            });
            const result = await res.json();
            if (result.success) {
                alert(t("update_success") || "Update successful!");
                setSelectedForRakeback(null);
                // Refresh current view
                fetchDetails(data.user.id);
            } else {
                alert(result.error || "Update failed");
            }
        } catch (error) {
            alert("Unexpected error");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {t("details")} - {data?.user?.name || data?.user?.code}
                    </DialogTitle>
                </DialogHeader>

                {loading || !data ? (
                    <div className="flex justify-center py-20">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="space-y-6 mt-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                                <p className="text-xs text-muted-foreground">{t("balance")}</p>
                                <p className={`text-lg font-bold ${data.user.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {data.user.balance?.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                                <p className="text-xs text-muted-foreground">Rake</p>
                                <p className="text-lg font-bold text-red-600">
                                    {data.user.totalRake?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                </p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                                <p className="text-xs text-muted-foreground">{t("rakeback")} ({data.user.rakeback}%)</p>
                                <p className="text-lg font-bold text-blue-600">
                                    {data.user.totalRakebackAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                </p>
                            </div>
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                                <p className="text-xs text-muted-foreground">Role</p>
                                <p className="text-lg font-bold">{data.user.role}</p>
                            </div>
                        </div>

                        {/* Conditional Table Rendering */}
                        {data.subPlayers.length > 0 ? (
                            <div className="space-y-2">
                                <h3 className="font-semibold flex justify-between items-center">
                                    <span>{t("my_club")} ({data.subPlayers.length})</span>
                                    <span className={data.subPlayers.reduce((sum, p) => sum + (p.balance || 0), 0) >= 0 ? "text-green-600" : "text-red-500"}>
                                        {t("total_balance")}: {data.subPlayers.reduce((sum, p) => sum + (p.balance || 0), 0).toLocaleString()}
                                    </span>
                                </h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>{t("code")}</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead className="text-right">{t("balance")}</TableHead>
                                                <TableHead className="text-right">{t("actions")}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.subPlayers.map(p => (
                                                <TableRow key={p.id}>
                                                    <TableCell>{p.name || "N/A"}</TableCell>
                                                    <TableCell className="font-medium text-blue-600">{p.code}</TableCell>
                                                    <TableCell>{p.role}</TableCell>
                                                    <TableCell className={`text-right ${p.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {p.balance?.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right flex justify-end gap-1">
                                                        <Button variant="ghost" size="sm" onClick={() => navigateTo(p)}>
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            {t("details")}
                                                        </Button>
                                                        {(currentUser.role === "MANAGER" || currentUser.role === "ADMIN" || currentUser.id === data.user.id) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-blue-600"
                                                                onClick={() => {
                                                                    setSelectedForRakeback(p);
                                                                    setNewRakeback(p.rakeback.toString());
                                                                }}
                                                            >
                                                                <Settings2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <h3 className="font-semibold">{t("recent_games")}</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                                        <TableRow>
                                            <TableHead>{t("date")}</TableHead>
                                            <TableHead>{t("table")}</TableHead>
                                            <TableHead className="text-right">{t("pnl")}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.games.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-6 text-muted-foreground italic">
                                                    No games found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            data.games.map(game => (
                                                <TableRow key={game.id}>
                                                    <TableCell>{new Date(game.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-xs">{game.tableName}</TableCell>
                                                    <TableCell className={`text-right font-bold ${game.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {game.pnl >= 0 ? '+' : ''}{game.pnl?.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>

            <Dialog open={!!selectedForRakeback} onOpenChange={(open) => !open && setSelectedForRakeback(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("set_rakeback")}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="modal-rakeback" className="text-right">
                                {t("rakeback")} (%)
                            </Label>
                            <Input
                                id="modal-rakeback"
                                type="number"
                                step="0.5"
                                min="0"
                                max={(currentUser.role === 'MANAGER' || currentUser.role === 'ADMIN') ? 100 : currentUser.rakeback}
                                value={newRakeback}
                                onChange={(e) => setNewRakeback(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedForRakeback(null)}>Cancel</Button>
                        <Button onClick={handleUpdateRakeback} disabled={updating}>
                            {updating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t("save") || "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
