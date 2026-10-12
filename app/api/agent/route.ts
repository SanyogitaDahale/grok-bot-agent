import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "@/db";
import { AgentConfig, Routines } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
// import { unauthorized } from "next/navigation";


export async function POST(req: NextRequest) {
  try {
    const { agentId, name, description, agentImage, sourceAgentId } = await req.json();

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    let sourceAgent: Pick<typeof AgentConfig.$inferSelect, "name" | "description" | "agentImage" | "tools"> | undefined;
    if (typeof sourceAgentId === "string" && sourceAgentId.trim()) {
      const [source] = await db.select({
        name: AgentConfig.name,
        description: AgentConfig.description,
        agentImage: AgentConfig.agentImage,
        tools: AgentConfig.tools,
      }).from(AgentConfig).where(and(
        eq(AgentConfig.agentid, sourceAgentId),
        eq(AgentConfig.userEmail, userEmail),
      )).limit(1);
      if (!source) return NextResponse.json({ error: "Agent to duplicate was not found" }, { status: 404 });
      sourceAgent = source;
    }

    // Insert new agent config into database
    const newAgentConfig = await db
      .insert(AgentConfig)
      .values({
        agentid: agentId,
        name: typeof name === "string" && name.trim() ? name.trim() : sourceAgent ? `Copy of ${sourceAgent.name}` : name,
        description: typeof description === "string" ? description : sourceAgent?.description,
        agentImage: typeof agentImage === "string" ? agentImage : sourceAgent?.agentImage,
        tools: sourceAgent?.tools ?? undefined,
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

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (typeof body.agentId !== "string" || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "A valid agent ID and active state are required" }, { status: 400 });
  }

  const [agent] = await db.update(AgentConfig)
    .set({ isActive: body.isActive })
    .where(and(
      eq(AgentConfig.userEmail, session.user.email),
      eq(AgentConfig.agentid, body.agentId),
    ))
    .returning({ agentid: AgentConfig.agentid, isActive: AgentConfig.isActive });

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agentConfig: agent });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId?.trim()) {
    return NextResponse.json({ error: "A valid agent ID is required" }, { status: 400 });
  }

  const [agent] = await db.select({ agentid: AgentConfig.agentid })
    .from(AgentConfig)
    .where(and(
      eq(AgentConfig.userEmail, session.user.email),
      eq(AgentConfig.agentid, agentId),
    ))
    .limit(1);

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const userEmail = session.user.email;

  await db.transaction(async (tx) => {
    await tx.delete(Routines).where(eq(Routines.agentId, agentId));
    await tx.delete(AgentConfig).where(and(
      eq(AgentConfig.userEmail, userEmail),
      eq(AgentConfig.agentid, agentId),
    ));
  });

  return NextResponse.json({ deleted: true, agentId });
}
