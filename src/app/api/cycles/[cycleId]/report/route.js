import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { managerSubordinatesWhereClause } from "@/lib/manager-scope";

export async function GET(req, { params }) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cycleId } = await params;
    const userId = session.user.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!["AGENT", "SUPER_AGENT", "MANAGER", "ADMIN"].includes(user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch cycle info
        const cycle = await prisma.cycle.findUnique({
            where: { id: cycleId },
            select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
            }
        });

        if (!cycle) {
            return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
        }

        // Build where clause based on user role
        let where = {};

        if (user.role === "ADMIN") {
            where = {};
        } else if (user.role === "MANAGER") {
            where = await managerSubordinatesWhereClause(prisma, user.id);
        } else {
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
                    where: { cycleId },
                    select: { rake: true, pnl: true, gameType: true }
                },
                playerRingTotals: {
                    where: { cycleId },
                    select: { totalPnl: true, totalRake: true }
                }
            },
            orderBy: { code: 'asc' }
        });

        const players = rawSubPlayers.map(p => {
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
                totalRakebackAmount,
                totalRake
            };
        });

        return NextResponse.json({ 
            cycle,
            players 
        });
    } catch (error) {
        console.error("Error fetching cycle report:", error);
        return NextResponse.json({ error: "Failed to fetch cycle report" }, { status: 500 });
    }
}
