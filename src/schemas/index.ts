import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const StartWorkoutSessionParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  workoutDayId: z.string().uuid(),
});

export const StartWorkoutSessionResponseSchema = z.object({
  userWorkoutSessionId: z.string().uuid(),
});

export const UpdateWorkoutSessionParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  workoutDayId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const UpdateWorkoutSessionBodySchema = z.object({
  completedAt: z.iso.datetime(),
});

export const UpdateWorkoutSessionResponseSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
});

export const HomeParamsSchema = z.object({
  date: z.iso.date(),
});

export const HomeResponseSchema = z.object({
  activeWorkoutPlanId: z.string().uuid().nullable(),
  todayWorkoutDay: z
    .object({
      workoutPlanId: z.string().uuid(),
      id: z.string().uuid(),
      name: z.string().trim().min(1),
      isRest: z.boolean(),
      weekDay: z.enum(WeekDay),
      estimatedDurationInSeconds: z.number().min(0),
      coverImageUrl: z.string().url().optional(),
      exercisesCount: z.number().int().min(0),
    })
    .nullable(),
  workoutStreak: z.number().int().min(0),
  consistencyByDay: z.record(
    z.string(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});

export const GetWorkoutPlansQuerySchema = z.object({
  active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const GetWorkoutPlansResponseSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1),
    isActive: z.boolean(),
    workoutDays: z.array(
      z.object({
        id: z.string().uuid(),
        weekDay: z.enum(WeekDay),
        name: z.string().trim().min(1),
        isRest: z.boolean(),
        coverImageUrl: z.string().url().optional(),
        estimatedDurationInSeconds: z.number().min(0),
        exercises: z.array(
          z.object({
            id: z.string().uuid(),
            name: z.string().trim().min(1),
            order: z.number().int().min(0),
            sets: z.number().int().min(1),
            reps: z.number().int().min(1),
            restTimeInSeconds: z.number().int().min(1),
          }),
        ),
      }),
    ),
  }),
);

export const GetWorkoutPlanResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  workoutDays: z.array(
    z.object({
      id: z.string().uuid(),
      weekDay: z.enum(WeekDay),
      name: z.string().trim().min(1),
      isRest: z.boolean(),
      coverImageUrl: z.string().url().optional(),
      estimatedDurationInSeconds: z.number().min(0),
      exercisesCount: z.number().int().min(0),
    }),
  ),
});

export const GetWorkoutDayParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  workoutDayId: z.string().uuid(),
});

export const GetWorkoutDayResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  isRest: z.boolean(),
  coverImageUrl: z.string().url().optional(),
  estimatedDurationInSeconds: z.number().min(0),
  weekDay: z.enum(WeekDay),
  exercises: z.array(
    z.object({
      id: z.string().uuid(),
      workoutDayId: z.string().uuid(),
      name: z.string().trim().min(1),
      order: z.number().int().min(0),
      sets: z.number().int().min(1),
      reps: z.number().int().min(1),
      restTimeInSeconds: z.number().int().min(1),
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.string().uuid(),
      workoutDayId: z.string().uuid(),
      startedAt: z.iso.date().optional(),
      completedAt: z.iso.date().optional(),
    }),
  ),
});

export const WorkoutPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  workoutDays: z.array(
    z.object({
      name: z.string().trim().min(1),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean().default(false),
      estimatedDurationInSeconds: z.number().min(1),
      coverImageUrl: z.string().url().optional(),
      exercises: z.array(
        z.object({
          order: z.number().min(0),
          name: z.string().trim().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          restTimeInSeconds: z.number().min(1),
        }),
      ),
    }),
  ),
});

export const GetStatsQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});

export const GetStatsResponseSchema = z.object({
  workoutStreak: z.number().int().min(0),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
  completedWorkoutsCount: z.number().int().min(0),
  conclusionRate: z.number().min(0).max(1),
  totalTimeInSeconds: z.number().int().min(0),
});

export const UpsertUserTrainDataBodySchema = z.object({
  weightInGrams: z.number().int().min(1),
  heightInCentimeters: z.number().int().min(1),
  age: z.number().int().min(1).max(150),
  bodyFatPercentage: z.number().int().min(0).max(100),
});

export const UserTrainDataResponseSchema = z.object({
  userId: z.string().uuid(),
  userName: z.string().trim().min(1),
  weightInGrams: z.number().int().min(0),
  heightInCentimeters: z.number().int().min(0),
  age: z.number().int().min(0),
  bodyFatPercentage: z.number().min(0).max(100),
});

export const UpsertUserTrainDataResponseSchema = z.object({
  userId: z.string().uuid(),
  weightInGrams: z.number().int().min(0),
  heightInCentimeters: z.number().int().min(0),
  age: z.number().int().min(0),
  bodyFatPercentage: z.number().int().min(0).max(100),
});

export const GetUserTrainDataResponseSchema =
  UserTrainDataResponseSchema.nullable();
