import {
  ConflictError,
  NotFoundError,
  WorkoutPlanNotActiveError,
} from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export interface OutputDto {
  userWorkoutSessionId: string;
}

export class StartWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    return prisma.$transaction(async (tx) => {
      const workoutPlan = await tx.workoutPlan.findUnique({
        where: { id: dto.workoutPlanId },
        include: {
          workoutDays: {
            where: { id: dto.workoutDayId },
          },
        },
      });

      if (!workoutPlan || workoutPlan.userId !== dto.userId) {
        throw new NotFoundError("Workout plan not found");
      }

      if (!workoutPlan.isActive) {
        throw new WorkoutPlanNotActiveError("Workout plan is not active");
      }

      if (workoutPlan.workoutDays.length === 0) {
        throw new NotFoundError("Workout day not found");
      }

      const activeSession = await tx.workoutSession.findFirst({
        where: {
          workoutDayId: dto.workoutDayId,
          completedAt: null,
        },
      });

      if (activeSession) {
        throw new ConflictError(
          "A session for this day has already been started",
        );
      }

      const session = await tx.workoutSession.create({
        data: {
          workoutDayId: dto.workoutDayId,
          startedAt: new Date(),
        },
      });

      return {
        userWorkoutSessionId: session.id,
      };
    });
  }
}
