import { FastifyInstance } from "fastify";

export const aiRoutes = async (app: FastifyInstance) => {
  app.post("/ai", async function (request, reply) {
    return reply.send({ message: "Hello World" });
  });
};
