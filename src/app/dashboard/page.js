import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { managerSubordinatesWhereClause } from "@/lib/manager-scope";
import PlayerView from "@/components/dashboard/player-view";
import AgentView from "@/components/dashboard/agent-view";

import AdminView from "@/components/dashboard/admin-view";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

/** Financial column order (Winning → Rake → Rakeback → Balance) is applied in AgentView and PlayerView. */

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const userId = session.user.id;
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        // Should not happen if session exists but good to handle
        return <div>User not found</div>;
    }

    // Fetch Current Cycle
    const currentCycle = await prisma.cycle.findFirst({
        where: { status: "OPEN" },
        orderBy: { startDate: 'desc' }
    });

    const currentCycleId = currentCycle?.id;

    const clubFullRows = await prisma.clubFullManager.findMany({
        select: { clubId: true, managerId: true },
    });
    const clubFullByClubId = Object.fromEntries(
        clubFullRows.map((r) => [r.clubId, r.managerId])
    );

    const managersList = await prisma.user.findMany({
        where: { role: "MANAGER" },
        select: { id: true, name: true, code: true },
        orderBy: { code: "asc" },
    });

    // Fetch games for the user (Current Cycle); ring sessions for table, MTT for totals
    const games = await prisma.gameSession.findMany({
        where: {
            userId: user.id,
            cycleId: currentCycleId
        },
        orderBy: { date: 'desc' },
        take: 50,
    });

    // Winnings/rake for current user: ring totals + MTT sessions
    let totalWinnings = 0;
    let totalRake = 0;
    if (currentCycleId) {
        const ringTotals = await prisma.playerRingTotal.findMany({
            where: { userId: user.id, cycleId: currentCycleId },
            select: { totalPnl: true, totalRake: true },
        });
        totalWinnings = ringTotals.reduce((s, r) => s + (r.totalPnl || 0), 0);
        totalRake = ringTotals.reduce((s, r) => s + (r.totalRake || 0), 0);
        games.forEach((g) => {
            if (g.gameType === 'MTT') {
                totalWinnings += g.pnl || 0;
                totalRake += g.rake || 0;
            }
        });
    }

    // Role Based Data Fetching
    let subPlayers = [];

    if (["AGENT", "SUPER_AGENT", "MANAGER", "ADMIN"].includes(user.role)) {
        let where = {};

        if (user.role === "ADMIN") {
            where = {}; // Admin sees all
        } else if (user.role === "MANAGER") {
            where = await managerSubordinatesWhereClause(prisma, user.id);
        } else {
            // Agents and Super Agents
            where = {
                OR: [
                    { agentId: user.id },
                    { superAgentId: user.id }
                ]
            };
        }

        const rawSubPlayers = await prisma.user.findMany({
            where,
            include: {
                agent: { select: { name: true, code: true } },
                superAgent: { select: { name: true, code: true } },
                manager: { select: { name: true, code: true } },
                gameSessions: {
                    where: { cycleId: currentCycleId },
                    select: { rake: true, pnl: true, gameType: true }
                },
                playerRingTotals: {
                    where: { cycleId: currentCycleId },
                    select: { totalPnl: true, totalRake: true }
                }
            },
            orderBy: { code: 'asc' }
        });

        subPlayers = rawSubPlayers.map(p => {
            const ringPnl = (p.playerRingTotals || []).reduce((s, r) => s + (r.totalPnl || 0), 0);
            const ringRake = (p.playerRingTotals || []).reduce((s, r) => s + (r.totalRake || 0), 0);
            const mttPnl = (p.gameSessions || []).filter(gs => gs.gameType === 'MTT').reduce((s, gs) => s + (gs.pnl || 0), 0);
            const mttRake = (p.gameSessions || []).filter(gs => gs.gameType === 'MTT').reduce((s, gs) => s + (gs.rake || 0), 0);
            const totalPnL = ringPnl + mttPnl;
            const totalRake = ringRake + mttRake;
            const totalRakebackAmount = (totalRake * (p.rakeback || 0)) / 100;
            const { gameSessions, playerRingTotals, balance: _storedBalance, ...rest } = p;
            return {
                ...rest,
                balance: totalPnL + totalRakebackAmount, // balance = winnings + rakeback
                totalWinnings: totalPnL,
                totalRakebackAmount,
                totalRake
            };
        });
    }

    if (user.role === "ADMIN") {
        return (
            <AdminView
                user={user}
                games={games}
                subPlayers={subPlayers}
                clubFullByClubId={clubFullByClubId}
                managers={managersList}
            />
        );
    } else if (["MANAGER", "SUPER_AGENT", "AGENT"].includes(user.role)) {
        return (
            <AgentView
                user={user}
                games={games}
                subPlayers={subPlayers}
                clubFullByClubId={clubFullByClubId}
                managers={managersList}
            />
        );
    } else {
        return <PlayerView user={user} games={games} totalWinnings={totalWinnings} totalRake={totalRake} />;
    }
}
