import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const body = await request.json();
  const { action, name, slug, userId, orgId } = body;

  try {
    if (action === "createOrg") {
      const org = await prisma.organization.create({
        data: { name, slug }
      });
      return NextResponse.json(org);
    }

    if (action === "assignUser") {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { organizationId: orgId }
      });
      return NextResponse.json(user);
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
