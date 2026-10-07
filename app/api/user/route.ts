import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { db, users } from "@/db";
import { getServerSession } from "next-auth";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const result = await db
            .insert(users)
            .values({
                name: session.user.name,
                email: session.user.email,
            })
            .onConflictDoNothing({
                target: users.email,
            })
            .returning();

        if (result.length === 0) {
            return NextResponse.json(
                { message: "User already exists" },
                { status: 200 }
            );
        }

        return NextResponse.json(
            {
                message: "User Saved Successfully",
                user: result,
            },
            { status: 201 }
        );

    } catch (e) {
        console.error("USER API ERROR:", e);

        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}