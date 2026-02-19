import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function PATCH(req) {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && session.user.role !== "SUPER_AGENT" && session.user.role !== "AGENT")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { userId, rakeback } = await req.json();

        if (!userId || rakeback === undefined) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        // Role check for rakeback limit
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // Authorization: Verify user can modify this target user
        if (session.user.role !== "ADMIN") {
            if (session.user.role === "MANAGER") {
                // Manager can only modify their direct subordinates
                if (targetUser.managerId !== session.user.id) {
                    return NextResponse.json({ error: "You can only modify rakeback for your direct subordinates" }, { status: 403 });
                }
            } else {
                // Agents and Super Agents can only modify their direct subordinates
                if (targetUser.agentId !== session.user.id && targetUser.superAgentId !== session.user.id) {
                    return NextResponse.json({ error: "You can only modify rakeback for your direct subordinates" }, { status: 403 });
                }
                // Agents can only set rakeback up to their own percentage
                const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
                if (rakeback > currentUser.rakeback) {
                    return NextResponse.json({ error: `You cannot set a rakeback higher than your own (${currentUser.rakeback}%)` }, { status: 400 });
                }
            }
        }

        await prisma.user.update({
            where: { id: userId },
            data: { rakeback: parseFloat(rakeback) }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}
