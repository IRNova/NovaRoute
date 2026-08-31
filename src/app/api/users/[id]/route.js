import { NextResponse } from "next/server";
import { getUserById, updateUser, deleteUser } from "@/lib/db/repos/usersRepo.js";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

export const dynamic = "force-dynamic";

// PATCH /api/users/[id] — { role?, isActive?, password? }
export async function PATCH(request, { params }) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const user = await updateUser(id, body);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    // "last active admin" lands here: a 409 says the request was understood
    // and refused on purpose, not malformed.
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
}

// DELETE /api/users/[id]
export async function DELETE(request, { params }) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });
  try {
    await deleteUser(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
}
