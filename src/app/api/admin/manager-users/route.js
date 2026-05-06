import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

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

    const { action } = body;

    try {
        if (action === "promote") {
            const { userId } = body;
            if (!userId) {
                return NextResponse.json({ error: "userId is required" }, { status: 400 });
            }

            const existingUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true },
            });

            if (!existingUser) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }

            if (existingUser.role === "ADMIN") {
                return NextResponse.json({ error: "Cannot change admin role" }, { status: 400 });
            }

            await prisma.user.update({
                where: { id: userId },
                data: { role: "MANAGER" },
            });

            return NextResponse.json({ success: true });
        }

        if (action === "create") {
            const code = body.code?.trim();
            const name = body.name?.trim();
            const password = body.password;

            if (!code || !name || !password) {
                return NextResponse.json(
                    { error: "code, name and password are required" },
                    { status: 400 }
                );
            }

            if (password.length < 4) {
                return NextResponse.json(
                    { error: "Password must be at least 4 characters" },
                    { status: 400 }
                );
            }

            const existingByCode = await prisma.user.findUnique({
                where: { code },
                select: { id: true },
            });

            if (existingByCode) {
                return NextResponse.json({ error: "User code already exists" }, { status: 409 });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            await prisma.user.create({
                data: {
                    code,
                    name,
                    password: hashedPassword,
                    role: "MANAGER",
                },
            });

            return NextResponse.json({ success: true });
        }

        if (action === "revoke") {
            const { userId } = body;
            if (!userId) {
                return NextResponse.json({ error: "userId is required" }, { status: 400 });
            }

            const existingUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true },
            });

            if (!existingUser) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }

            if (existingUser.role !== "MANAGER") {
                return NextResponse.json({ error: "User is not a manager" }, { status: 400 });
            }

            await prisma.user.update({
                where: { id: userId },
                data: { role: "SUPER_AGENT" },
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("manager-users POST error:", error);
        return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }
}
