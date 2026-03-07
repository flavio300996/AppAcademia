import { prisma } from "../lib/db.js";

interface OutputDto {
  userId: string;
  userName: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

export class GetUserTrainData {
  async execute(userId: string): Promise<OutputDto | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        weightInGrams: true,
        heightInCm: true,
        age: true,
        bodyFatPercentage: true,
      },
    });

    if (!user) {
      return null;
    }

    // Se nenhum dado de treino foi preenchido, retorna null
    if (
      user.weightInGrams === null &&
      user.heightInCm === null &&
      user.age === null &&
      user.bodyFatPercentage === null
    ) {
      return null;
    }

    return {
      userId: user.id,
      userName: user.name,
      weightInGrams: user.weightInGrams ?? 0,
      heightInCentimeters: user.heightInCm ?? 0,
      age: user.age ?? 0,
      bodyFatPercentage: user.bodyFatPercentage ?? 0,
    };
  }
}
