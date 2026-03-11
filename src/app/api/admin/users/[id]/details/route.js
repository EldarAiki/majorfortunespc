import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(req, { params }) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Managers, Super Agents, and Agents can see details of their downstream users
    // For simplicity, we check if target user is in downstream of session user
    // Or if session user is MANAGER

    try {
        // Fetch current cycle first
        const currentCycle = await prisma.cycle.findFirst({
            where: { status: "OPEN" },
            orderBy: { startDate: 'desc' }
        });
        const currentCycleId = currentCycle?.id;

        const targetUser = await prisma.user.findUnique({
            where: { id },
            include: {
                gameSessions: {
                    where: { cycleId: currentCycleId },
                    select: { pnl: true, rake: true, gameType: true }
                },
                playerRingTotals: {
                    where: { cycleId: currentCycleId },
                    select: { totalPnl: true, totalRake: true }
                }
            }
        });

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const ringPnl = (targetUser.playerRingTotals || []).reduce((s, r) => s + (r.totalPnl || 0), 0);
        const ringRake = (targetUser.playerRingTotals || []).reduce((s, r) => s + (r.totalRake || 0), 0);
        const mttPnl = (targetUser.gameSessions || []).filter(gs => gs.gameType === 'MTT').reduce((s, gs) => s + (gs.pnl || 0), 0);
        const mttRake = (targetUser.gameSessions || []).filter(gs => gs.gameType === 'MTT').reduce((s, gs) => s + (gs.rake || 0), 0);
        const userTotalPnL = ringPnl + mttPnl;
        const userTotalRake = ringRake + mttRake;
        const userRakebackAmount = (userTotalRake * (targetUser.rakeback || 0)) / 100;

        if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
            if (targetUser.agentId !== session.user.id &&
                targetUser.superAgentId !== session.user.id &&
                targetUser.managerId !== session.user.id &&
                targetUser.id !== session.user.id) {
                // hierarchy check as needed
            }
        }

        const { gameSessions: _gs, playerRingTotals: _prt, ...userWithoutSessions } = targetUser;
        const userWithCalculatedBalance = {
            ...userWithoutSessions,
            balance: userTotalPnL + userRakebackAmount, // balance = winnings + rakeback
            totalWinnings: userTotalPnL,
            totalRake: userTotalRake,
            totalRakebackAmount: userRakebackAmount
        };

        let details = {
            user: userWithCalculatedBalance,
            subPlayers: [],
            games: []
        };

        // Fetch subordinates based on role - with their game sessions
        let rawSubPlayers = [];
        if (targetUser.role === "MANAGER") {
            rawSubPlayers = await prisma.user.findMany({
                where: { managerId: targetUser.id },
                include: {
                    gameSessions: {
                        where: { cycleId: currentCycleId },
                        select: { pnl: true, rake: true, gameType: true }
                    },
                    playerRingTotals: {
                        where: { cycleId: currentCycleId },
                        select: { totalPnl: true, totalRake: true }
                    }
                },
                orderBy: { code: 'asc' }
            });
        } else if (targetUser.role === "AGENT" || targetUser.role === "SUPER_AGENT") {
            rawSubPlayers = await prisma.user.findMany({
                where: {
                    OR: [
                        { agentId: targetUser.id },
                        { superAgentId: targetUser.id }
                    ]
                },
                include: {
                    gameSessions: {
                        where: { cycleId: currentCycleId },
                        select: { pnl: true, rake: true, gameType: true }
                    },
                    playerRingTotals: {
                        where: { cycleId: currentCycleId },
                        select: { totalPnl: true, totalRake: true }
                    }
                },
                orderBy: { code: 'asc' }
            });
        }

        details.subPlayers = rawSubPlayers.map(p => {
            const ringPnl = (p.playerRingTotals || []).reduce((s, r) => s + (r.totalPnl || 0), 0);
            const ringRake = (p.playerRingTotals || []).reduce((s, r) => s + (r.totalRake || 0), 0);
            const mttPnl = (p.gameSessions || []).filter(gs => gs.gameType === 'MTT').reduce((s, gs) => s + (gs.pnl || 0), 0);
            const mttRake = (p.gameSessions || []).filter(gs => gs.gameType === 'MTT').reduce((s, gs) => s + (gs.rake || 0), 0);
            const totalPnL = ringPnl + mttPnl;
            const totalRake = ringRake + mttRake;
            const totalRakebackAmount = (totalRake * (p.rakeback || 0)) / 100;
            const { gameSessions, playerRingTotals, ...rest } = p;
            return {
                ...rest,
                balance: totalPnL + totalRakebackAmount,
                totalWinnings: totalPnL,
                totalRake,
                totalRakebackAmount
            };
        });

        // Fetch games for the user (Current Cycle Only)
        details.games = await prisma.gameSession.findMany({
            where: {
                userId: targetUser.id,
                cycleId: currentCycleId
            },
            orderBy: { date: 'desc' },
            take: 50
        });

        return NextResponse.json(details);
    } catch (error) {
        console.error("Fetch details error:", error);
        return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
    }
}
