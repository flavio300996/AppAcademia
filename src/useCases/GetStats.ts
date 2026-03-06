import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { prisma } from "../lib/db.js";

dayjs.extend(utc);

interface InputDto {
  userId: string;
  from: string;
  to: string;
}

export interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const fromDate = dayjs.utc(dto.from);
    const toDate = dayjs.utc(dto.to);

    const workoutPlanIds = await prisma.workoutPlan.findMany({
      where: { userId: dto.userId },
      select: { id: true },
    });

    const ids = workoutPlanIds.map((p) => p.id);

    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: {
            in: ids,
          },
        },
        startedAt: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    });

    const sessionsByDay = new Map<string, typeof sessions>();

    for (const session of sessions) {
      const key = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
      if (!sessionsByDay.has(key)) {
        sessionsByDay.set(key, []);
      }
      sessionsByDay.get(key)!.push(session);
    }

    const consistencyByDay: OutputDto["consistencyByDay"] = {};

    for (const [day, daySessions] of sessionsByDay) {
      const workoutDayStarted = daySessions.length > 0;
      const workoutDayCompleted = daySessions.some(
        (s) => s.completedAt !== null,
      );
      consistencyByDay[day] = { workoutDayCompleted, workoutDayStarted };
    }

    const completedWorkoutsCount = sessions.filter(
      (s) => s.completedAt !== null,
    ).length;
    const totalSessions = sessions.length;
    const conclusionRate =
      totalSessions > 0 ? completedWorkoutsCount / totalSessions : 0;

    const totalTimeInSeconds = sessions
      .filter((s) => s.completedAt !== null)
      .reduce((acc, s) => {
        const duration = dayjs
          .utc(s.completedAt!)
          .diff(dayjs.utc(s.startedAt), "second");
        return acc + duration;
      }, 0);

    const workoutStreak = this.calculateStreak(sessionsByDay, toDate);

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }

  private calculateStreak(
    sessionsByDay: Map<
      string,
      Array<{ startedAt: Date; completedAt: Date | null }>
    >,
    toDate: dayjs.Dayjs,
  ): number {
    let streak = 0;
    let day = toDate;

    for (let i = 0; i < 365; i++) {
      const dateKey = day.format("YYYY-MM-DD");
      if (sessionsByDay.has(dateKey)) {
        streak++;
        day = day.subtract(1, "day");
      } else {
        break;
      }
    }

    return streak;
  }
}
