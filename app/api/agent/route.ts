import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { AgentConfig, db } from "@/db";
import { desc, eq } from "drizzle-orm";


export async function POST(req: NextRequest) {
  try {
    const { agentId, name, description, agentImage } = await req.json();

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // Insert new agent config into database
    const newAgentConfig = await db
      .insert(AgentConfig)
      .values({
        agentid: agentId,
        name,
        description,
        agentImage,
        userEmail,
      })
      .returning();

    return NextResponse.json({
      message: "Agent Configuration Saved Successfully",
      agentConfig: newAgentConfig,
    });
  } catch (error) {
    console.error("Failed to create agent:", error);

    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Fetch all agent configurations for the logged-in user
  const agentConfig = await db
    .select()
    .from(AgentConfig)
    .where(eq(AgentConfig.userEmail, session.user.email))
    .orderBy(desc(AgentConfig.createdAt));

  return NextResponse.json({ agentConfig })

}