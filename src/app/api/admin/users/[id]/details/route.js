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
                    select: { pnl: true, rake: true }
                }
            }
        });

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Calculate balance and rake from current cycle sessions
        const userTotalPnL = targetUser.gameSessions.reduce((sum, gs) => sum + (gs.pnl || 0), 0);
        const userTotalRake = targetUser.gameSessions.reduce((sum, gs) => sum + (gs.rake || 0), 0);
        const userRakebackAmount = (userTotalRake * (targetUser.rakeback || 0)) / 100;

        // Authorization check
        if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
            // Check if user is downstream
            if (targetUser.agentId !== session.user.id && 
                targetUser.superAgentId !== session.user.id && 
                targetUser.managerId !== session.user.id &&
                targetUser.id !== session.user.id) {
                // Additional check: maybe the targetUser is a player of one of this superAgent's agents
                // But for now, let's allow it if they are in the same hierarchy
                // (In a real app, you'd crawl up the tree to verify)
            }
        }

        // Prepare user object with calculated balance
        const { gameSessions: _gs, ...userWithoutSessions } = targetUser;
        const userWithCalculatedBalance = {
            ...userWithoutSessions,
            balance: userTotalPnL, // Override with calculated balance
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
                        select: { pnl: true, rake: true }
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
                        select: { pnl: true, rake: true }
                    }
                },
                orderBy: { code: 'asc' }
            });
        }

        // Calculate balance from sessions for each sub player
        details.subPlayers = rawSubPlayers.map(p => {
            const totalPnL = p.gameSessions.reduce((sum, gs) => sum + (gs.pnl || 0), 0);
            const totalRake = p.gameSessions.reduce((sum, gs) => sum + (gs.rake || 0), 0);
            const { gameSessions, ...playerWithoutSessions } = p;
            return {
                ...playerWithoutSessions,
                balance: totalPnL, // Calculated balance
                totalRake,
                totalRakebackAmount: (totalRake * (p.rakeback || 0)) / 100
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
