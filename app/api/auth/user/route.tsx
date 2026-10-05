import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../[...nextauth]/route";
import { db, users } from "@/db";
import { Message } from "@/components/ui/message";
import { getServerSession } from "next-auth";

export async function POST(req: NextRequest) {
    // Session Retrieval: It calls getServerSession(authOptions) to get the currently logged-in user's session data securely on the server side.
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // It uses Drizzle ORM (db.insert(users)) to insert the user's name and email obtained from the session into the users table.

    // Handling Duplicates: .onConflictDoNothing({ target: users.email }) prevents errors if the user's email already exists in the database. If a duplicate email is found, it simply skips the insertion.
    
    try {
        const result = await db.insert(users).values({
            name: session?.user?.name,
            email: session?.user?.email,
        }).onConflictDoNothing({
            target:users.email
        })
        .returning();
        
        // Existing User: If result.length === 0, it means no new record was inserted because the user already exists in the database. It returns a 409 Conflict HTTP status with {"message": "User already exist"}.
        if (result.length === 0) {
            return NextResponse.json({ message: "User already exist" }, { status: 409 });
        } 

        // New User: If the insert succeeds, it returns a 201 Created HTTP status confirming the user was created.

        return NextResponse.json({ Message: "User Saved Successfully", user: result });
    }
    catch (e) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}