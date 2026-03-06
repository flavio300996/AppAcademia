import dayjs from "dayjs";

import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  sessionId: string;
  completedAt: string;
}

export interface OutputDto {
  id: string;
  startedAt: string;
  completedAt: string;
}

export class UpdateWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.workoutSession.findUnique({
        where: { id: dto.sessionId },
        include: {
          workoutDay: {
            include: {
              workoutPlan: true,
            },
          },
        },
      });

      if (
        !session ||
        session.workoutDay.id !== dto.workoutDayId ||
        session.workoutDay.workoutPlan.id !== dto.workoutPlanId ||
        session.workoutDay.workoutPlan.userId !== dto.userId
      ) {
        throw new NotFoundError("Workout session not found");
      }

      const completedAtDate = dayjs(dto.completedAt).toDate();

      const updatedSession = await tx.workoutSession.update({
        where: { id: dto.sessionId },
        data: {
          completedAt: completedAtDate,
        },
      });

      return {
        id: updatedSession.id,
        startedAt: updatedSession.startedAt.toISOString(),
        completedAt: (
          updatedSession.completedAt ?? completedAtDate
        ).toISOString(),
      };
    });
  }
}
