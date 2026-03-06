import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);

interface InputDto {
  userId: string;
  date: string;
}

export interface OutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercisesCount: number;
  };
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
}

const weekDayFromIndex: WeekDay[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    const targetDate = dayjs.utc(dto.date);

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: {
        workoutDays: {
          include: {
            exercises: true,
            workoutSessions: true,
          },
        },
      },
    });

    if (!activeWorkoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const targetWeekDay =
      weekDayFromIndex[targetDate.day()] ?? weekDayFromIndex[0];

    const todayWorkoutDay =
      activeWorkoutPlan?.workoutDays.find(
        (day: { weekDay: string }) => day.weekDay === targetWeekDay,
      ) ?? null;

    if (!todayWorkoutDay) {
      throw new NotFoundError("No workout day found for today");
    }

    const startOfWeek = targetDate.day(0).startOf("day");
    const endOfWeek = targetDate.add(6).endOf("day");

    const weekSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: activeWorkoutPlan.id,
        },
        startedAt: {
          gte: startOfWeek.toDate(),
          lte: endOfWeek.toDate(),
        },
      },
      include: {
        workoutDay: {
          include: {
            workoutPlan: true,
          },
        },
      },
    });

    const consistencyByDay: OutputDto["consistencyByDay"] = {};

    const sessionsByDay = new Map();

    for (const session of weekSessions) {
      const key = dayjs.utc(session.startedAt).format("YYYY-MM-DD");

      if (!sessionsByDay.has(key)) {
        sessionsByDay.set(key, []);
      }

      sessionsByDay.get(key).push(session);
    }

    const DAYS_IN_WEEK = 7;

    for (let i = 0; i < DAYS_IN_WEEK; i += 1) {
      const day = startOfWeek.clone().add(i, "day");
      const key = day.format("YYYY-MM-DD");

      const daySessions = sessionsByDay.get(key) || [];

      const workoutDayStarted = daySessions.length > 0;

      const workoutDayCompleted = daySessions.some(
        (s: (typeof daySessions)[number]) => s.completedAt !== null,
      );

      consistencyByDay[key] = { workoutDayCompleted, workoutDayStarted };
    }

    const workoutStreak = await this.calculateStreak(
      activeWorkoutPlan.id,
      activeWorkoutPlan.workoutDays,
      targetDate,
    );

    return {
      activeWorkoutPlanId: activeWorkoutPlan.id,
      todayWorkoutDay: {
        workoutPlanId: activeWorkoutPlan.id,
        id: todayWorkoutDay.id,
        name: todayWorkoutDay.name,
        isRest: todayWorkoutDay.isRest,
        weekDay: todayWorkoutDay.weekDay,
        estimatedDurationInSeconds: todayWorkoutDay.estimatedDurationInSeconds,
        coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
        exercisesCount: todayWorkoutDay.exercises.length,
      },
      workoutStreak,
      consistencyByDay,
    };
  }

  private async calculateStreak(
    workoutPlanId: string,
    workoutDays: Array<{
      weekDay: string;
      isRest: boolean;
      workoutSessions: Array<{ startedAt: Date; completedAt: Date | null }>;
    }>,
    currentDate: dayjs.Dayjs,
  ): Promise<number> {
    const planWeekDays = new Set(workoutDays.map((d) => d.weekDay));
    const restWeekDays = new Set(
      workoutDays.filter((d) => d.isRest).map((d) => d.weekDay),
    );

    const allSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: { workoutPlanId },
        completedAt: { not: null },
      },
      select: { startedAt: true },
    });

    const completedDates = new Set(
      allSessions.map((s) => dayjs.utc(s.startedAt).format("YYYY-MM-DD")),
    );

    let streak = 0;
    let day = currentDate;

    for (let i = 0; i < 365; i++) {
      const weekDay = weekDayFromIndex[day.day()];

      if (!planWeekDays.has(weekDay)) {
        day = day.subtract(1, "day");
        continue;
      }

      if (restWeekDays.has(weekDay)) {
        streak++;
        day = day.subtract(1, "day");
        continue;
      }

      const dateKey = day.format("YYYY-MM-DD");
      if (completedDates.has(dateKey)) {
        streak++;
        day = day.subtract(1, "day");
        continue;
      }

      break;
    }

    return streak;
  }
}
