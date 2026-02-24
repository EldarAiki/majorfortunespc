"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Download, Search, Settings2, Eye, RefreshCw, ChevronRight, ChevronDown, Users } from "lucide-react";
import PlayerView from "./player-view";
import { useLanguage } from "@/lib/i18n";
import ExcelJS from "exceljs";
import { useState, useEffect } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import DetailsModal from "./details-modal";

export default function AgentView({ user, games, subPlayers }) {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [newRakeback, setNewRakeback] = useState("");
    const [updating, setUpdating] = useState(false);
    const [detailUserId, setDetailUserId] = useState(null);
    const [drilledUserId, setDrilledUserId] = useState(null);
    const [expandedNodes, setExpandedNodes] = useState(new Set());

    const toggleNode = (nodeId) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId);
        } else {
            newExpanded.add(nodeId);
        }
        setExpandedNodes(newExpanded);
    };

    const [activitySearchTerm, setActivitySearchTerm] = useState("");
    const [cycles, setCycles] = useState([]);
    const [cyclesLoading, setCyclesLoading] = useState(false);

    useEffect(() => {
        const fetchCycles = async () => {
            setCyclesLoading(true);
            try {
                const res = await fetch("/api/cycles");
                const data = await res.json();
                if (data.cycles) {
                    setCycles(data.cycles);
                }
            } catch (error) {
                console.error("Failed to fetch cycles:", error);
            } finally {
                setCyclesLoading(false);
            }
        };
        fetchCycles();
    }, []);

    const handleUpdateRakeback = async () => {
        if (!selectedPlayer || newRakeback === "") return;

        setUpdating(true);
        try {
            const res = await fetch("/api/admin/users/rakeback", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedPlayer.id,
                    rakeback: parseFloat(newRakeback),
                }),
            });

            const data = await res.json();
            if (data.success) {
                alert(t("update_success") || "Update successful!");
                setSelectedPlayer(null);
                window.location.reload();
            } else {
                alert(data.error || "Update failed");
            }
        } catch (error) {
            alert("Unexpected error");
        } finally {
            setUpdating(false);
        }
    };

    const filteredPlayers = subPlayers?.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const totalBalance = filteredPlayers.reduce((sum, p) => sum + (p.balance || 0), 0);

    // 1. Build the Hierarchy Tree
    const buildHierarchy = () => {
        const nodes = new Map();
        const clubs = {};

        // 1. First pass: Ensure all nodes exist in the map
        subPlayers?.forEach(u => {
            const id = u.id || u.code;
            if (!id) return;

            if (!nodes.has(id)) {
                const personalRake = u.totalRake || 0;
                const personalRakeback = u.totalRakebackAmount || 0;
                const personalWinning = (u.balance || 0) - personalRake + personalRakeback;
                
                nodes.set(id, {
                    ...u,
                    id,
                    type: u.role || 'PLAYER',
                    children: [],
                    personalBalance: u.balance || 0,
                    groupBalance: 0,
                    personalRake: personalRake,
                    groupRake: 0,
                    totalRake: (u.totalRakebackAmount || 0), // Keep for backward compatibility (rakeback amount)
                    personalWinning: personalWinning,
                    groupWinning: 0,
                    rakeback: u.rakeback || 0,
                    _parentFound: false
                });
            } else {
                // Update existing placeholder with actual data
                const existing = nodes.get(id);
                Object.assign(existing, u);
                if (u.role) existing.type = u.role;
                existing.personalBalance = u.balance || 0;
                const personalRake = u.totalRake || 0;
                const personalRakeback = u.totalRakebackAmount || 0;
                existing.personalRake = personalRake;
                existing.personalWinning = (u.balance || 0) - personalRake + personalRakeback;
                existing.totalRake = personalRakeback; // Keep for backward compatibility (rakeback amount)
                existing.rakeback = u.rakeback || 0;
            }

            // Ensure Club exists
            if (u.clubId && !clubs[u.clubId]) {
                clubs[u.clubId] = {
                    id: u.clubId,
                    code: u.clubId,
                    name: u.clubName || u.clubId,
                    type: 'CLUB',
                    children: [],
                    personalBalance: 0,
                    groupBalance: 0,
                    personalRake: 0,
                    groupRake: 0,
                    totalRake: 0,
                    personalWinning: 0,
                    groupWinning: 0,
                    rakeback: 0,
                    managerId: null, // Will be set if any user in club has managerId
                    _parentFound: false // Clubs can be under managers
                };
            }
            // Track managerId for clubs (if any user in a club has a managerId, the club is under that manager)
            if (u.clubId && u.managerId && clubs[u.clubId]) {
                clubs[u.clubId].managerId = u.managerId;
            }
        });

        // 2. Second pass: Establish parent-child relationships
        nodes.forEach(node => {
            let parent = null;

            // Priority order for finding parent:
            // 1. Direct manager (managerId)
            // 2. Direct agent/super agent
            // 3. Club (if no direct manager/agent relationship)
            
            if (node.type === 'PLAYER') {
                if (node.managerId && nodes.has(node.managerId)) parent = nodes.get(node.managerId);
                else if (node.agentId && nodes.has(node.agentId)) parent = nodes.get(node.agentId);
                else if (node.superAgentId && nodes.has(node.superAgentId)) parent = nodes.get(node.superAgentId);
                else if (node.clubId && clubs[node.clubId]) parent = clubs[node.clubId];
            } else if (node.type === 'AGENT') {
                if (node.managerId && nodes.has(node.managerId)) parent = nodes.get(node.managerId);
                else if (node.superAgentId && nodes.has(node.superAgentId)) parent = nodes.get(node.superAgentId);
                else if (node.clubId && clubs[node.clubId]) parent = clubs[node.clubId];
            } else if (node.type === 'SUPER_AGENT') {
                if (node.managerId && nodes.has(node.managerId)) parent = nodes.get(node.managerId);
                else if (node.clubId && clubs[node.clubId]) parent = clubs[node.clubId];
            } else if (node.type === 'MANAGER') {
                // Managers don't have parents (they're at the top)
                node._parentFound = true;
            }

            if (parent && parent !== node) {
                if (!parent.children.find(c => c.id === node.id)) {
                    parent.children.push(node);
                    node._parentFound = true;
                }
            }
        });

        // 3. Third pass: Attach clubs to managers and handle remaining orphans
        Object.values(clubs).forEach(club => {
            if (!club._parentFound && club.managerId && nodes.has(club.managerId)) {
                const managerNode = nodes.get(club.managerId);
                if (!managerNode.children.find(c => c.id === club.id)) {
                    managerNode.children.push(club);
                    club._parentFound = true;
                }
            }
        });

        // 4. Fourth pass: Ensure remaining orphans are attached to clubs or managers
        nodes.forEach(node => {
            if (!node._parentFound) {
                if (node.clubId && clubs[node.clubId]) {
                    clubs[node.clubId].children.push(node);
                    node._parentFound = true;
                } else if (node.managerId && nodes.has(node.managerId)) {
                    const managerNode = nodes.get(node.managerId);
                    if (!managerNode.children.find(c => c.id === node.id)) {
                        managerNode.children.push(node);
                        node._parentFound = true;
                    }
                }
            }
        });

        // Aggregation Logic
        const aggregate = (node) => {
            let gBalance = node.personalBalance || 0;
            let gRake = node.personalRake || 0;
            let gRakeback = node.totalRake || 0; // rakeback amount (already calculated as rake * rakeback% / 100)

            node.children.forEach(child => {
                const { groupBalance, groupRake, groupRakeback } = aggregate(child);
                gBalance += groupBalance;
                gRake += groupRake;
                gRakeback += groupRakeback;
            });

            node.groupBalance = gBalance;
            node.groupRake = gRake;
            node.totalRake = gRakeback; // Keep for backward compatibility (rakeback amount)
            node.groupWinning = gBalance - gRake + gRakeback;
            return { groupBalance: gBalance, groupRake: gRake, groupRakeback: gRakeback };
        };

        // Aggregate all root nodes (managers, clubs without managers, and orphan nodes)
        const rootNodes = [];
        
        // Find managers (they are root nodes)
        nodes.forEach(node => {
            if (node.type === 'MANAGER' && !node._parentFound) {
                rootNodes.push(node);
            }
        });
        
        // Find clubs that don't have managers (or managers not in the current view)
        Object.values(clubs).forEach(club => {
            if (!club._parentFound) {
                rootNodes.push(club);
            }
        });
        
        // Aggregate all root nodes
        rootNodes.forEach(aggregate);

        // Filter Logic
        const filterTree = (nodes) => {
            if (!activitySearchTerm) return nodes;
            return nodes.filter(node => {
                const matches = (node.name || "").toLowerCase().includes(activitySearchTerm.toLowerCase()) ||
                    (node.code || "").toLowerCase().includes(activitySearchTerm.toLowerCase());

                // Recursively filter children
                const filteredChildren = filterTree(node.children || []);
                const hasMatchingChildren = filteredChildren.length > 0;

                if (hasMatchingChildren) {
                    node.children = filteredChildren;
                }

                return matches || hasMatchingChildren;
            });
        };

        // Filter and Clean result - return root nodes (managers and clubs)
        let result = rootNodes.filter(n =>
            (n.name && n.name !== "Unknown Club" && n.id) ||
            (n.children && n.children.length > 0)
        );

        if (activitySearchTerm) {
            // We need to clone nodes if we are going to modify children for filtering
            const clone = (n) => ({ ...n, children: n.children.map(clone) });
            result = filterTree(result.map(clone));
        }

        // Drilling Logic
        if (drilledUserId) {
            const findNode = (list, id) => {
                for (const n of list) {
                    if (n.id === id) return n;
                    if (n.children) {
                        const found = findNode(n.children, id);
                        if (found) return found;
                    }
                }
                return null;
            };
            const foundNode = findNode(rootNodes, drilledUserId);
            return foundNode ? [foundNode] : result;
        }

        return result;
    };

    const hierarchy = buildHierarchy();

    const HierarchyRow = ({ node, level = 0 }) => {
        const hasChildren = node.children && node.children.length > 0;
        const name = node.name || node.code || "N/A";
        const isManagement = node.type !== 'PLAYER';
        const isExpanded = expandedNodes.has(node.id);
        const shouldShowChildren = hasChildren && isExpanded;

        // Calculate values for display
        const displayBalance = isManagement ? node.groupBalance : node.personalBalance;
        const displayRake = isManagement ? node.groupRake : node.personalRake;
        const displayWinning = isManagement ? node.groupWinning : node.personalWinning;
        const displayRakeback = node.totalRake || 0; // rakeback amount

        return (
            <>
                <TableRow className={`group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${level === 0 ? 'bg-zinc-50/10 font-bold' : ''}`}>
                    <TableCell style={{ paddingLeft: `${level * 24 + 12}px` }} className="font-medium">
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <button
                                    onClick={() => toggleNode(node.id)}
                                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                    aria-label={isExpanded ? "Collapse" : "Expand"}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4" />
                                    )}
                                </button>
                            ) : (
                                <div className="w-6" />
                            )}
                            {isManagement ? (
                                <div className={`p-1.5 rounded ${node.type === 'CLUB' ? 'bg-amber-100 text-amber-700' :
                                    node.type === 'MANAGER' ? 'bg-green-100 text-green-700' :
                                    node.type === 'SUPER_AGENT' ? 'bg-purple-100 text-purple-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                    <Users className="h-3 w-3" />
                                </div>
                            ) : (
                                <div className="w-6" />
                            )}
                            <div className="flex flex-col">
                                <span className="flex items-center gap-2 text-sm">
                                    {name}
                                    {isManagement && (
                                        <span className="text-[10px] uppercase opacity-60 font-black px-1.5 py-0.5 rounded border border-current">
                                            {node.type === 'SUPER_AGENT' ? 'SA' : node.type === 'MANAGER' ? 'MGR' : node.type}
                                        </span>
                                    )}
                                </span>
                                {isManagement && node.code && <span className="text-[10px] text-muted-foreground font-normal">{node.code}</span>}
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                            <span className={`font-bold tabular-nums ${displayBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {isManagement ? (
                                    <>
                                        Total: {displayBalance.toLocaleString()}
                                        <span className="text-[10px] block text-muted-foreground font-normal">
                                            (Personal: {node.personalBalance.toLocaleString()})
                                        </span>
                                    </>
                                ) : (
                                    displayBalance.toLocaleString()
                                )}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                            <span className="text-orange-600 font-semibold tabular-nums">
                                {displayRake?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </span>
                            {isManagement && (
                                <span className="text-[10px] block text-muted-foreground font-normal">
                                    (Personal: {node.personalRake?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'})
                                </span>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                            <span className={`font-semibold tabular-nums ${displayWinning >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {displayWinning?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </span>
                            {isManagement && (
                                <span className="text-[10px] block text-muted-foreground font-normal">
                                    (Personal: {node.personalWinning?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'})
                                </span>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                            <span className="text-blue-600 font-semibold tabular-nums">
                                {displayRakeback?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </span>
                            <span className="text-xs text-muted-foreground font-normal">
                                ({node.rakeback}%)
                            </span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        {isManagement && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDrilledUserId(node.id === drilledUserId ? null : node.id)}
                                className={`h-8 px-2 ${node.id === drilledUserId ? 'bg-blue-50 text-blue-600' : ''}`}
                            >
                                <Eye className="h-4 w-4 mr-1" />
                                {node.id === drilledUserId ? "Reset" : "⤷"}
                            </Button>
                        )}
                        {!isManagement && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-zinc-600 hover:text-zinc-700 hover:bg-zinc-100"
                                onClick={() => setDetailUserId(node.id)}
                            >
                                <Eye className="h-4 w-4 mr-1" />
                                {t("details")}
                            </Button>
                        )}
                    </TableCell>
                </TableRow>
                {shouldShowChildren && node.children.map(child => (
                    <HierarchyRow key={child.id} node={child} level={level + 1} />
                ))}
            </>
        );
    };

    const getSafeName = (entity) => {
        if (!entity) return "";
        if (entity.name && entity.name !== "-" && entity.name.trim() !== "") return entity.name;
        return entity.code || "";
    };


    const handleDownloadCurrentCycle = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('My Group');

        sheet.columns = [
            { header: t('code'), key: 'code', width: 15 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Role', key: 'role', width: 15 },
            { header: t('balance'), key: 'balance', width: 15 },
            { header: t('rakeback'), key: 'rakeback', width: 15 },
        ];

        filteredPlayers.forEach(p => {
            sheet.addRow({
                code: p.code,
                name: p.name,
                role: p.role,
                balance: p.balance,
                rakeback: p.rakeback + '%'
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `Group_Report_${user.code}_Current.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    const handleDownloadCycleReport = async (cycle) => {
        try {
            const res = await fetch(`/api/cycles/${cycle.id}/report`);
            const data = await res.json();

            if (!data.players) {
                alert("Failed to fetch cycle data");
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const cycleDateStr = new Date(cycle.startDate).toLocaleDateString();
            const sheet = workbook.addWorksheet('My Group');

            sheet.columns = [
                { header: t('code'), key: 'code', width: 15 },
                { header: 'Name', key: 'name', width: 25 },
                { header: 'Role', key: 'role', width: 15 },
                { header: t('balance'), key: 'balance', width: 15 },
                { header: t('rakeback'), key: 'rakeback', width: 15 },
            ];

            data.players.forEach(p => {
                sheet.addRow({
                    code: p.code,
                    name: p.name,
                    role: p.role,
                    balance: p.balance,
                    rakeback: p.rakeback + '%'
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `Group_Report_${user.code}_${cycleDateStr.replace(/\//g, '-')}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download cycle report:", error);
            alert("Failed to download cycle report");
        }
    };

    const formatCycleDate = (cycle) => {
        const start = new Date(cycle.startDate).toLocaleDateString();
        const end = cycle.endDate ? new Date(cycle.endDate).toLocaleDateString() : t("current_cycle") || "Current";
        return cycle.status === "OPEN" ? `${start} - ${end}` : `${start} - ${end}`;
    };

    const flattenHierarchy = (nodes, level = 0, result = []) => {
        nodes.forEach(node => {
            const isManagement = node.type !== 'PLAYER';
            const displayBalance = isManagement ? node.groupBalance : node.personalBalance;
            const displayRake = isManagement ? node.groupRake : node.personalRake;
            const displayWinning = isManagement ? node.groupWinning : node.personalWinning;
            const displayRakeback = node.totalRake || 0;

            result.push({
                level,
                name: node.name || node.code || "N/A",
                code: node.code || "",
                type: node.type,
                balance: displayBalance,
                rake: displayRake,
                winning: displayWinning,
                rakeback: displayRakeback,
                rakebackPercent: node.rakeback || 0,
            });

            if (node.children && node.children.length > 0) {
                flattenHierarchy(node.children, level + 1, result);
            }
        });
        return result;
    };

    const handleDownloadActivityCurrentCycle = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Club Activity');

        sheet.columns = [
            { header: 'User / Group', key: 'name', width: 30 },
            { header: t('code'), key: 'code', width: 15 },
            { header: 'Type', key: 'type', width: 15 },
            { header: t('balance'), key: 'balance', width: 15 },
            { header: 'Rake', key: 'rake', width: 15 },
            { header: 'Winning', key: 'winning', width: 15 },
            { header: t('rakeback'), key: 'rakeback', width: 15 },
            { header: 'Rakeback %', key: 'rakebackPercent', width: 12 },
        ];

        const flatData = flattenHierarchy(hierarchy);
        flatData.forEach(row => {
            const indent = '  '.repeat(row.level);
            sheet.addRow({
                name: indent + row.name,
                code: row.code,
                type: row.type,
                balance: row.balance,
                rake: row.rake,
                winning: row.winning,
                rakeback: row.rakeback,
                rakebackPercent: row.rakebackPercent + '%',
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `Activity_Report_${user.code}_Current.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    const handleDownloadActivityCycleReport = async (cycle) => {
        try {
            const res = await fetch(`/api/cycles/${cycle.id}/activity`);
            const data = await res.json();

            if (!data.players) {
                alert("Failed to fetch cycle data");
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const cycleDateStr = new Date(cycle.startDate).toLocaleDateString();
            const sheet = workbook.addWorksheet('Club Activity');

            sheet.columns = [
                { header: 'User / Group', key: 'name', width: 30 },
                { header: t('code'), key: 'code', width: 15 },
                { header: 'Type', key: 'type', width: 15 },
                { header: t('balance'), key: 'balance', width: 15 },
                { header: 'Rake', key: 'rake', width: 15 },
                { header: 'Winning', key: 'winning', width: 15 },
                { header: t('rakeback'), key: 'rakeback', width: 15 },
                { header: 'Rakeback %', key: 'rakebackPercent', width: 12 },
            ];

            data.players.forEach(p => {
                const totalRake = p.totalRake || 0;
                const totalRakebackAmount = p.totalRakebackAmount || 0;
                const balance = p.balance || 0;
                const winning = balance - totalRake + totalRakebackAmount;

                sheet.addRow({
                    name: p.name || p.code || "N/A",
                    code: p.code,
                    type: p.role,
                    balance: balance,
                    rake: totalRake,
                    winning: winning,
                    rakeback: totalRakebackAmount,
                    rakebackPercent: (p.rakeback || 0) + '%',
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `Activity_Report_${user.code}_${cycleDateStr.replace(/\//g, '-')}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download cycle activity report:", error);
            alert("Failed to download cycle activity report");
        }
    };

    return (
        <Tabs defaultValue="stats" className="space-y-4">
            <TabsList className="bg-zinc-100 dark:bg-zinc-800 p-1">
                <TabsTrigger value="stats" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950">
                    {t("personal_stats")}
                </TabsTrigger>
                <TabsTrigger value="club" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950">
                    {t("my_club")}
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950">
                    {t("club_activity")}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="space-y-4">
                <PlayerView user={user} games={games} />
            </TabsContent>

            <TabsContent value="club" className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t("search_players")}
                            className="bg-white dark:bg-zinc-900 border-none shadow-sm pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                {t("download_report")}
                                <ChevronDown className="h-4 w-4 ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>{t("select_cycle") || "Select Cycle"}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {cycles.length === 0 && cyclesLoading && (
                                <DropdownMenuItem disabled>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                </DropdownMenuItem>
                            )}
                            {cycles.map((cycle, index) => (
                                <DropdownMenuItem
                                    key={cycle.id}
                                    onClick={() => cycle.status === "OPEN" ? handleDownloadCurrentCycle() : handleDownloadCycleReport(cycle)}
                                    className="cursor-pointer"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    <span className="flex-1">
                                        {cycle.status === "OPEN" ? (
                                            <span className="font-medium">{t("current_cycle") || "Current Cycle"}</span>
                                        ) : (
                                            formatCycleDate(cycle)
                                        )}
                                    </span>
                                    {cycle.status === "OPEN" && (
                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                            {t("active") || "Active"}
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                            {cycles.length === 0 && !cyclesLoading && (
                                <DropdownMenuItem disabled>
                                    No cycles available
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <Card className="border-none shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <span>{t("my_club")}</span>
                            <span className={totalBalance >= 0 ? "text-green-600" : "text-red-500"}>
                                {t("total_balance")}: {totalBalance.toLocaleString()}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-primary/10">
                                    <TableHead>{t("code")}</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">{t("balance")}</TableHead>
                                    <TableHead className="text-right">{t("rakeback")}</TableHead>
                                    <TableHead className="text-right">{t("actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPlayers.map((player) => (
                                    <TableRow key={player.id} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <TableCell className="font-medium">{player.code}</TableCell>
                                        <TableCell>{player.name || "N/A"}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                                {player.role}
                                            </span>
                                        </TableCell>
                                        <TableCell className={`text-right font-bold ${player.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {player.balance?.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right text-blue-600 font-semibold">{player.rakeback}%</TableCell>
                                        <TableCell className="text-right flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={() => {
                                                    setSelectedPlayer(player);
                                                    setNewRakeback(player.rakeback.toString());
                                                }}
                                            >
                                                <Settings2 className="h-4 w-4 mr-1" />
                                                {t("set_rakeback")}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-zinc-600 hover:text-zinc-700 hover:bg-zinc-100"
                                                onClick={() => setDetailUserId(player.id)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                {t("details")}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredPlayers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                                            No players found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t("search_players")}
                            className="bg-white dark:bg-zinc-900 border-none shadow-sm pl-9"
                            value={activitySearchTerm}
                            onChange={(e) => setActivitySearchTerm(e.target.value)}
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                {t("download_report")}
                                <ChevronDown className="h-4 w-4 ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>{t("select_cycle") || "Select Cycle"}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {cycles.length === 0 && cyclesLoading && (
                                <DropdownMenuItem disabled>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                </DropdownMenuItem>
                            )}
                            {cycles.map((cycle) => (
                                <DropdownMenuItem
                                    key={cycle.id}
                                    onClick={() => cycle.status === "OPEN" ? handleDownloadActivityCurrentCycle() : handleDownloadActivityCycleReport(cycle)}
                                    className="cursor-pointer"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    <span className="flex-1">
                                        {cycle.status === "OPEN" ? (
                                            <span className="font-medium">{t("current_cycle") || "Current Cycle"}</span>
                                        ) : (
                                            formatCycleDate(cycle)
                                        )}
                                    </span>
                                    {cycle.status === "OPEN" && (
                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                            {t("active") || "Active"}
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                            {cycles.length === 0 && !cyclesLoading && (
                                <DropdownMenuItem disabled>
                                    No cycles available
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <Card className="border-none shadow-lg">
                    <CardHeader>
                        <CardTitle>{t("club_activity")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-primary/10">
                                    <TableHead>User / Group</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-right">Rake</TableHead>
                                    <TableHead className="text-right">Winning</TableHead>
                                    <TableHead className="text-right">Rakeback</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {hierarchy.map((node) => (
                                    <HierarchyRow key={node.id} node={node} />
                                ))}
                                {hierarchy.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                                            No activity found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("set_rakeback")}</DialogTitle>
                        <DialogDescription>
                            Update rakeback for player {selectedPlayer?.code}.
                            {(user.role !== 'MANAGER' && user.role !== 'ADMIN') && ` Max allowed: ${user.rakeback}%`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="rakeback" className="text-right">
                                {t("rakeback")} (%)
                            </Label>
                            <Input
                                id="rakeback"
                                type="number"
                                step="0.5"
                                min="0"
                                max={(user.role === 'MANAGER' || user.role === 'ADMIN') ? 100 : user.rakeback}
                                value={newRakeback}
                                onChange={(e) => setNewRakeback(e.target.value)}
                                className="col-span-3"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedPlayer(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateRakeback} disabled={updating}>
                            {updating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t("save") || "Save Change"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DetailsModal
                userId={detailUserId}
                isOpen={!!detailUserId}
                onClose={() => setDetailUserId(null)}
                currentUser={user}
            />
        </Tabs>
    );
}
