"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, History } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import ExcelJS from "exceljs";
import { useState } from "react";
import DetailsModal from "./details-modal";

export default function PlayerView({ user, games }) {
    const { t } = useLanguage();
    const [showDetails, setShowDetails] = useState(false);

    // Calculate balance from current cycle games instead of stored value
    const cycleBalance = games?.reduce((sum, g) => sum + (g.pnl || 0), 0) || 0;
    const cycleRake = games?.reduce((sum, g) => sum + (g.rake || 0), 0) || 0;
    const cycleRakeback = (cycleRake * (user.rakeback || 0)) / 100;

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('My Games');

        sheet.columns = [
            { header: t('date'), key: 'date', width: 20 },
            { header: t('table'), key: 'table', width: 25 },
            { header: t('buy_in'), key: 'buyIn', width: 15 },
            { header: t('cash_out'), key: 'cashOut', width: 15 },
            { header: t('pnl'), key: 'pnl', width: 15 },
        ];

        games?.forEach(game => {
            sheet.addRow({
                date: new Date(game.date).toLocaleDateString(),
                table: game.tableName,
                buyIn: game.buyIn,
                cashOut: game.cashOut,
                pnl: game.pnl
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `Games_Report_${user.code}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight text-primary">{t("personal_stats")}</h2>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => setShowDetails(true)}
                    >
                        <History className="h-4 w-4" />
                        {t("details")}
                    </Button>
                    <Button onClick={handleExport} variant="outline" size="sm" className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        {t("export_excel")}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-white dark:bg-zinc-900 border-none shadow-md overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                            Name
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {user.name || "N/A"}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-none shadow-md overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                            {t("code")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {user.code}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-none shadow-md overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                            {t("balance")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${cycleBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {cycleBalance?.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-none shadow-md overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                            Rake
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {cycleRake?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-zinc-900 border-none shadow-md overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                            {t("rakeback")} ({user.rakeback}%)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {cycleRakeback?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-lg">
                <CardHeader>
                    <CardTitle>{t("recent_games")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-primary/10">
                                <TableHead>{t("date")}</TableHead>
                                <TableHead>{t("table")}</TableHead>
                                <TableHead className="text-right">{t("buy_in")}</TableHead>
                                <TableHead className="text-right">{t("cash_out")}</TableHead>
                                <TableHead className="text-right">{t("pnl")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!games || games.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                                        No recent games found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                games.map((game) => (
                                    <TableRow key={game.id} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <TableCell className="font-medium">
                                            {new Date(game.date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>{game.tableName}</TableCell>
                                        <TableCell className="text-right">{game.buyIn?.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{game.cashOut?.toLocaleString()}</TableCell>
                                        <TableCell className={`text-right font-bold ${game.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {game.pnl >= 0 ? '+' : ''}{game.pnl?.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <DetailsModal
                userId={user.id}
                isOpen={showDetails}
                onClose={() => setShowDetails(false)}
                currentUser={user}
            />
        </div>
    );
}
