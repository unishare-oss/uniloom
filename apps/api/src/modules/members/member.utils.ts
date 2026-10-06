import type { Role } from '@/generated/prisma/enums.js';

export const view = (member: {
  userId: string;
  role: Role;
  createdAt: Date;
  user: { name: string; email: string; image: string | null };
}) => ({
  userId: member.userId,
  name: member.user.name,
  email: member.user.email,
  image: member.user.image,
  role: member.role,
  createdAt: member.createdAt,
});
