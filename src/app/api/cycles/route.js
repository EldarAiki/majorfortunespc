import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(req) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const cycles = await prisma.cycle.findMany({
            orderBy: { startDate: 'desc' },
            select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
            }
        });

        return NextResponse.json({ cycles });
    } catch (error) {
        console.error("Error fetching cycles:", error);
        return NextResponse.json({ error: "Failed to fetch cycles" }, { status: 500 });
    }
}
