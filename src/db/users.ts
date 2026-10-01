// src/db/users.ts
import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    // Check if the first user in the system is created; if so, make them SUPER_ADMIN
    const existingUsers = await db.select().from(users).limit(1);
    const assignedRole = existingUsers.length === 0 ? 'SUPER_ADMIN' : 'VIEWER';

    const result = await db.insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
        role: assignedRole,
        status: 'ACTIVE',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name: name || email.split('@')[0],
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Failed to get or create user:", error);
    throw new Error("Failed to register user in database", { cause: error });
  }
}

export async function updateUserRole(uid: string, role: string) {
  try {
    const result = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.uid, uid))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Failed to update user role:", error);
    throw new Error("Failed to update user role", { cause: error });
  }
}
