import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

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

        let where = {};

        if (user.role === "ADMIN") {
            where = {};
        } else if (user.role === "MANAGER") {
            where = {
                OR: [
                    { managerId: user.id },
                ]
            };
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
                    select: { rake: true, pnl: true }
                }
            },
            orderBy: { code: 'asc' }
        });

        const players = rawSubPlayers.map(p => {
            const totalRake = p.gameSessions.reduce((sum, gs) => sum + (gs.rake || 0), 0);
            const totalPnL = p.gameSessions.reduce((sum, gs) => sum + (gs.pnl || 0), 0);
            const totalRakebackAmount = (totalRake * (p.rakeback || 0)) / 100;
            
            const { gameSessions, ...userWithoutGames } = p;
            return {
                ...userWithoutGames,
                balance: totalPnL,
                totalRakebackAmount,
                totalRake
            };
        });

        return NextResponse.json({ 
            cycle,
            players 
        });
    } catch (error) {
        console.error("Error fetching cycle activity:", error);
        return NextResponse.json({ error: "Failed to fetch cycle activity" }, { status: 500 });
    }
}
