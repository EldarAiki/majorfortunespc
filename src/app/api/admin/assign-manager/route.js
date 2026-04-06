import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

async function collectDescendantUserIds(rootId) {
    const ids = new Set([rootId]);
    let frontier = [rootId];

    while (frontier.length > 0) {
        const batch = frontier;
        frontier = [];
        const children = await prisma.user.findMany({
            where: {
                OR: [{ agentId: { in: batch } }, { superAgentId: { in: batch } }],
            },
            select: { id: true },
        });
        for (const c of children) {
            if (!ids.has(c.id)) {
                ids.add(c.id);
                frontier.push(c.id);
            }
        }
    }
    return [...ids];
}

export async function POST(req) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { userId, clubId, managerId, cascade = true } = body;

    if ((userId && clubId) || (!userId && !clubId)) {
        return NextResponse.json(
            { error: "Provide exactly one of userId or clubId" },
            { status: 400 }
        );
    }

    try {
        if (clubId) {
            if (managerId === null || managerId === undefined || managerId === "") {
                await prisma.clubFullManager.deleteMany({ where: { clubId: String(clubId) } });
                return NextResponse.json({ success: true });
            }
            const manager = await prisma.user.findFirst({
                where: { id: managerId, role: "MANAGER" },
            });
            if (!manager) {
                return NextResponse.json({ error: "Invalid manager user" }, { status: 400 });
            }
            await prisma.clubFullManager.upsert({
                where: { clubId: String(clubId) },
                create: { clubId: String(clubId), managerId },
                update: { managerId },
            });
            return NextResponse.json({ success: true });
        }

        const target = await prisma.user.findUnique({ where: { id: userId } });
        if (!target) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (managerId === null || managerId === undefined || managerId === "") {
            const ids = cascade ? await collectDescendantUserIds(target.id) : [target.id];
            await prisma.user.updateMany({
                where: { id: { in: ids } },
                data: { managerId: null },
            });
            return NextResponse.json({ success: true });
        }

        const manager = await prisma.user.findFirst({
            where: { id: managerId, role: "MANAGER" },
        });
        if (!manager) {
            return NextResponse.json({ error: "Invalid manager user" }, { status: 400 });
        }
        if (managerId === target.id) {
            return NextResponse.json({ error: "Cannot assign manager to themselves" }, { status: 400 });
        }

        const ids = cascade ? await collectDescendantUserIds(target.id) : [target.id];
        await prisma.user.updateMany({
            where: { id: { in: ids } },
            data: { managerId },
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("assign-manager:", e);
        return NextResponse.json({ error: "Assignment failed" }, { status: 500 });
    }
}
