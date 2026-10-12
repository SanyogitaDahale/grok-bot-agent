import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/db';
import { Tools } from '@/db/schema';
import { FALLBACK_TOOLKITS } from '@/lib/composio/tool-catalog';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const registered = await db.select({
      slug: Tools.slug,
      name: Tools.name,
      description: Tools.description,
      category: Tools.category,
    }).from(Tools).where(eq(Tools.isActive, true));

    const bySlug = new Map<string, { slug: string; name: string; description: string; category: string }>();
    for (const tool of registered) {
      bySlug.set(tool.slug.toLowerCase(), {
        slug: tool.slug.toLowerCase(),
        name: tool.name,
        description: tool.description ?? `Connect ${tool.name} to your agent.`,
        category: tool.category ?? 'General',
      });
    }
    for (const tool of FALLBACK_TOOLKITS) {
      if (!bySlug.has(tool.slug)) {
        bySlug.set(tool.slug, {
          slug: tool.slug,
          name: tool.name,
          description: tool.description,
          category: 'Productivity',
        });
      }
    }

    return NextResponse.json({ tools: [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (error) {
    console.error('Could not load tool catalog:', error);
    return NextResponse.json({ error: 'Could not load tool catalog' }, { status: 500 });
  }
}
