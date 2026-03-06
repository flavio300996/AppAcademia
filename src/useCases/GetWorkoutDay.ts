import dayjs from "dayjs";

import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

export interface OutputDto {
  id: string;
  name: string;
  isRest: boolean;
  coverImageUrl?: string;
  estimatedDurationInSeconds: number;
  weekDay: WeekDay;
  exercises: Array<{
    id: string;
    workoutDayId: string;
    name: string;
    order: number;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
  }>;
  sessions: Array<{
    id: string;
    workoutDayId: string;
    startedAt?: string;
    completedAt?: string;
  }>;
}

export class GetWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId, userId: dto.userId },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    const workoutDay = await prisma.workoutDay.findUnique({
      where: {
        id: dto.workoutDayId,
        workoutPlanId: dto.workoutPlanId,
      },
      include: {
        exercises: { orderBy: { order: "asc" } },
        workoutSessions: true,
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day not found");
    }

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRest,
      coverImageUrl: workoutDay.coverImageUrl ?? undefined,
      estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
      weekDay: workoutDay.weekDay,
      exercises: workoutDay.exercises.map((exercise) => ({
        id: exercise.id,
        workoutDayId: exercise.workoutDayId,
        name: exercise.name,
        order: exercise.order,
        sets: exercise.sets,
        reps: exercise.reps,
        restTimeInSeconds: exercise.restTimeInSeconds,
      })),
      sessions: workoutDay.workoutSessions.map((session) => ({
        id: session.id,
        workoutDayId: session.workoutDayId,
        startedAt: session.startedAt
          ? dayjs(session.startedAt).format("YYYY-MM-DD")
          : undefined,
        completedAt: session.completedAt
          ? dayjs(session.completedAt).format("YYYY-MM-DD")
          : undefined,
      })),
    };
  }
}
