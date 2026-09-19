import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createCategory } from "@/lib/places/geography";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

// Public: anyone can browse the category list (needed for search filters
// on the tourist-facing site, which has no auth requirement).
export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, parentId: true },
  });
  return NextResponse.json({ categories });
}

const CreateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100).optional(),
  parentId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "categories.manage");

    const body = await request.json().catch(() => null);
    const parsed = CreateCategorySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid category data.", parsed.error.flatten());
    }

    const category = await createCategory(parsed.data);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "category.create",
      targetType: "Category",
      targetId: category.id,
      metadata: { name: category.name, slug: category.slug },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) {
      logger.error({ err }, "Unexpected error in POST /api/categories");
    }
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
