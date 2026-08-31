import { NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/db/repos/usersRepo.js";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { ROLES, describeRole } from "@/lib/auth/roles.js";

export const dynamic = "force-dynamic";

// GET /api/users — accounts that can sign into this dashboard.
// Admin-only: the role gate in dashboardGuard rejects operator and viewer
// before the request reaches here.
export async function GET(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;

  const users = await listUsers();
  return NextResponse.json({
    users,
    roles: ROLES.map((role) => ({ role, description: describeRole(role) })),
  });
}

// POST /api/users — { username, password, role }
export async function POST(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;

  const body = await request.json().catch(() => ({}));
  try {
    const user = await createUser({
      username: body.username,
      password: body.password,
      role: body.role,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
