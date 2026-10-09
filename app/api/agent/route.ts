import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "@/db";
import { AgentConfig } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
// import { unauthorized } from "next/navigation";


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

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');


  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (agentId) {
    const agentConfig = await db.select().from(AgentConfig)
      .where(and(eq(AgentConfig.userEmail, session.user.email),
        eq(AgentConfig.agentid, agentId)))

    return NextResponse.json(agentConfig[0]);

  }

  // Fetch all agent configurations for the logged-in user
  const agentConfig = await db
    .select()
    .from(AgentConfig)
    .where(eq(AgentConfig.userEmail, session.user.email))
    .orderBy(desc(AgentConfig.createdAt));

  return NextResponse.json({ agentConfig })

}


export async function PUT(req: NextRequest) {
  const agentConfig = await req.json();
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Update the Agent Config Record
  const result = await db.update(AgentConfig)
    .set({
      name: agentConfig.name,
      description: agentConfig.description,
      agentImage: agentConfig.agentImage,
    })
    .where(and(
      eq(AgentConfig.userEmail, session.user.email),
      eq(AgentConfig.agentid, agentConfig.agentId)
    ))
    .returning()

  return NextResponse.json({ message: "Agent Configuration Updated successfully", agentConfig: result[0] })
}