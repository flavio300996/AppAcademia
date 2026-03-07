import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { AIRequestSchema, ErrorSchema } from "../schemas/index.js";
import { CreateWorkoutPlan } from "../useCases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../useCases/GetUserTrainData.js";
import { ListWorkoutPlans } from "../useCases/ListWorkoutPlans.js";
import { UpsertUserTrainData } from "../useCases/UpsertUserTrainData.js";

const SYSTEM_PROMPT = `Você é um personal trainer virtual especialista em montagem de planos de treino, com tom amigável, motivador e linguagem simples. Seu público são pessoas leigas em musculação, então evite jargões técnicos.

## Procedimento Inicial
SEMPRE comece chamando a ferramenta \`getUserTrainData\` antes de qualquer interação.

- Se o usuário **não tem dados cadastrados** (retornou null): Faça perguntas simples e diretas em UMA ÚNICA MENSAGEM para coletar: nome, peso (kg), altura (cm), idade e percentual de gordura corporal. Depois salve com \`updateUserTrainData\` (convertendo kg para gramas).
- Se o usuário **já tem dados**: Cumprimente pelo nome de forma amigável.

## Para Criar um Plano de Treino
Pergunte:
1. Qual é seu objetivo? (ganhar músculo, perder peso, ficar mais forte, etc.)
2. Quantos dias por semana você consegue treinar?
3. Tem alguma lesão ou restrição física?

Faça perguntas poucas, simples e diretas.

## Organização dos Treinos - Divisões (Splits)
Escolha a divisão adequada com base nos dias disponíveis:

- **2-3 dias/semana**: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
- **4 dias/semana**: Upper/Lower (cada grupo 2x/semana) ou ABCD (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen)
- **5 dias/semana**: PPLUL (Push/Pull/Legs + Upper/Lower - superior 3x, inferior 2x/semana)
- **6 dias/semana**: PPL 2x (Push/Pull/Legs repetido)

## Princípios de Montagem
- Músculos sinérgicos juntos (peito+tríceps, costas+bíceps)
- Exercícios compostos primeiro, depois isoladores
- 4-8 exercícios por sessão
- 3-4 séries por exercício, 8-12 reps (hipertrofia) ou 4-6 reps (força)
- Descanso: 60-90s (hipertrofia), 2-3min (compostos pesados)
- Não treinar o mesmo grupo muscular em dias consecutivos
- Nomes descritivos para cada dia (ex: "Superior A - Peito e Costas", "Descanso")

## Estrutura do Plano
O plano DEVE ter exatamente 7 dias (MONDAY a SUNDAY):
- Dias de treino: \`isRest: false\`, com exercícios e duração
- Dias de descanso: \`isRest: true\`, \`exercises: []\`, \`estimatedDurationInSeconds: 0\`

Forneça SEMPRE um coverImageUrl para cada dia:
- **Dias superiores** (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body):
  - \`https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v\`
  - \`https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL\`
- **Dias inferiores** (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
  - \`https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj\`
  - \`https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY\`

Alterne entre as duas opções de cada categoria. Dias de descanso usam imagem superior.

## Respostas
Sempre curtas, objetivas e motivadoras.`;

export const aiRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["AI"],
      summary: "Chat with AI personal trainer",
      body: AIRequestSchema,
      response: {
        200: z.any(),
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.status(401).send({
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      const { messages } = request.body;

      const result = streamText({
        model: openai("gpt-4o-mini"),
        system: SYSTEM_PROMPT,
        tools: {
          getUserTrainData: tool({
            description: "Busca os dados de treino do usuário autenticado.",
            inputSchema: z.object({}),
            execute: async () => {
              const getUserTrainData = new GetUserTrainData();
              const data = await getUserTrainData.execute(session.user.id);
              return (
                data || { message: "Usuário sem dados de treino cadastrados" }
              );
            },
          }),
          updateUserTrainData: tool({
            description: "Atualiza os dados de treino do usuário.",
            inputSchema: z.object({
              weightInGrams: z.number().int().describe("Peso em gramas"),
              heightInCentimeters: z
                .number()
                .int()
                .describe("Altura em centímetros"),
              age: z.number().int().describe("Idade em anos"),
              bodyFatPercentage: z
                .number()
                .int()
                .min(0)
                .max(100)
                .describe(
                  "Percentual de gordura corporal (0-100, onde 100 = 100%)",
                ),
            }),
            execute: async (input) => {
              const upsertUserTrainData = new UpsertUserTrainData();
              const result = await upsertUserTrainData.execute({
                userId: session.user.id,
                ...input,
              });
              return result;
            },
          }),
          getWorkoutPlans: tool({
            description: "Busca os planos de treino do usuário autenticado.",
            inputSchema: z.object({}),
            execute: async () => {
              const listWorkoutPlans = new ListWorkoutPlans();
              const plans = await listWorkoutPlans.execute({
                userId: session.user.id,
              });
              return plans;
            },
          }),
          createWorkoutPlan: tool({
            description: "Cria um novo plano de treino completo com 7 dias.",
            inputSchema: z.object({
              name: z.string().describe("Nome do plano de treino"),
              workoutDays: z
                .array(
                  z.object({
                    name: z
                      .string()
                      .describe("Nome do dia (ex: Peito e Tríceps, Descanso)"),
                    weekDay: z
                      .enum(WeekDay)
                      .describe("Dia da semana (MONDAY a SUNDAY)"),
                    isRest: z
                      .boolean()
                      .describe("true = descanso, false = treino"),
                    estimatedDurationInSeconds: z
                      .number()
                      .describe("Duração em segundos (0 para descanso)"),
                    coverImageUrl: z
                      .string()
                      .url()
                      .describe(
                        "URL de imagem (superior ou inferior conforme foco)",
                      ),
                    exercises: z
                      .array(
                        z.object({
                          order: z
                            .number()
                            .describe("Posição do exercício (1, 2, 3...)"),
                          name: z.string().describe("Nome do exercício"),
                          sets: z.number().describe("Número de séries"),
                          reps: z.number().describe("Número de repetições"),
                          restTimeInSeconds: z
                            .number()
                            .describe("Descanso entre séries (segundos)"),
                        }),
                      )
                      .describe("Lista de exercícios (vazia para descanso)"),
                  }),
                )
                .describe("Exatamente 7 dias (MONDAY a SUNDAY)"),
            }),
            execute: async (input) => {
              const createWorkoutPlan = new CreateWorkoutPlan();
              const result = await createWorkoutPlan.execute({
                userId: session.user.id,
                name: input.name,
                workoutDays: input.workoutDays,
              });
              return result;
            },
          }),
        },
        stopWhen: stepCountIs(5),
        messages: await convertToModelMessages(
          messages as unknown as UIMessage[],
        ),
      });

      const response = result.toUIMessageStreamResponse();
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      return reply.send(response.body);
    },
  });
};
