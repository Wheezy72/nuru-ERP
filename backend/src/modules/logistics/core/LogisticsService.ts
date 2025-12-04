import { TripStatus, GatePassStatus } from '@prisma/client';
import { createTenantPrismaClient } from '../../../shared/prisma/client';

type CreateTripInput = {
  vehicleRegistration: string;
  driverName?: string;
  driverPhone?: string;
  fromLocationCode: string;
  toLocationCode: string;
  plannedDate?: Date;
  userId?: string | null;
};

export class LogisticsService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private get prisma() {
    return createTenantPrismaClient(this.tenantId);
  }

  private generateTripCode() {
    const today = new Date();
    const y = today.getFullYear();
    const m = `${today.getMonth() + 1}`.padStart(2, '0');
    const d = `${today.getDate()}`.padStart(2, '0');
    const rand = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, '0');
    return `TRIP-${y}${m}${d}-${rand}`;
  }

  private generateGatePassCode() {
    const now = new Date();
    const y = now.getFullYear();
    const m = `${now.getMonth() + 1}`.padStart(2, '0');
    const d = `${now.getDate()}`.padStart(2, '0');
    const rand = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, '0');
    return `GP-${y}${m}${d}-${rand}`;
  }

  /**
   * Create a trip (or reuse vehicle) and an initial Gate Pass between two locations.
   * This does not yet bind invoices or perform stock moves; it sets up the
   * dispatch skeleton used for collusion control and gate scanning.
   */
  async createTripWithGatePass(input: CreateTripInput) {
    const prisma = this.prisma;

    if (!input.vehicleRegistration.trim()) {
      throw new Error('vehicleRegistration is required');
    }
    if (!input.fromLocationCode.trim() || !input.toLocationCode.trim()) {
      throw new Error('fromLocationCode and toLocationCode are required');
    }

    const [fromLocation, toLocation] = await Promise.all([
      prisma.location.findFirst({
        where: {
          tenantId: this.tenantId,
          code: input.fromLocationCode,
        },
      }),
      prisma.location.findFirst({
        where: {
          tenantId: this.tenantId,
          code: input.toLocationCode,
        },
      }),
    ]);

    if (!fromLocation) {
      throw new Error(`From location code ${input.fromLocationCode} not found`);
    }
    if (!toLocation) {
      throw new Error(`To location code ${input.toLocationCode} not found`);
    }

    const plannedDate = input.plannedDate ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      let vehicle = await tx.vehicle.findFirst({
        where: {
          tenantId: this.tenantId,
          registration: input.vehicleRegistration,
        },
      });

      if (!vehicle) {
        vehicle = await tx.vehicle.create({
          data: {
            tenantId: this.tenantId,
            registration: input.vehicleRegistration,
            driverName: input.driverName,
            driverPhone: input.driverPhone,
            isActive: true,
          },
        });
      } else if (
        input.driverName ||
        input.driverPhone
      ) {
        // Small convenience: update driver info if provided.
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: {
            driverName: input.driverName ?? vehicle.driverName,
            driverPhone: input.driverPhone ?? vehicle.driverPhone,
          },
        });
      }

      const tripCode = this.generateTripCode();
      const gatePassCode = this.generateGatePassCode();

      const trip = await tx.trip.create({
        data: {
          tenantId: this.tenantId,
          vehicleId: vehicle.id,
          code: tripCode,
          status: TripStatus.PLANNED,
          plannedDate,
        },
      });

      const gatePass = await tx.gatePass.create({
        data: {
          tenantId: this.tenantId,
          tripId: trip.id,
          fromLocationId: fromLocation.id,
          toLocationId: toLocation.id,
          status: GatePassStatus.DRAFT,
          code: gatePassCode,
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: input.userId ?? null,
          action: 'TRIP_CREATED',
          entityType: 'Trip',
          entityId: trip.id,
          metadata: {
            vehicleRegistration: vehicle.registration,
            fromLocationCode: fromLocation.code,
            toLocationCode: toLocation.code,
            plannedDate,
          },
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: input.userId ?? null,
          action: 'GATEPASS_CREATED',
          entityType: 'GatePass',
          entityId: gatePass.id,
          metadata: {
            code: gatePass.code,
            tripCode,
            fromLocationCode: fromLocation.code,
            toLocationCode: toLocation.code,
          },
        },
      });

      return { trip, gatePass, vehicle };
    });

    return result;
  }

  async listTrips() {
    const prisma = this.prisma;

    const trips = await prisma.trip.findMany({
      where: { tenantId: this.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: true,
        gatePasses: {
          orderBy: { createdAt: 'desc' },
        },
      },
      take: 100,
    });

    return trips;
  }

  async issueGatePass(gatePassId: string, userId?: string | null) {
    const prisma = this.prisma;

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const gatePass = await tx.gatePass.findFirst({
        where: {
          id: gatePassId,
          tenantId: this.tenantId,
        },
      });

      if (!gatePass) {
        throw new Error('Gate pass not found');
      }

      const trip = await tx.trip.findFirst({
        where: {
          id: gatePass.tripId,
          tenantId: this.tenantId,
        },
      });

      if (!trip) {
        throw new Error('Trip not found for gate pass');
      }

      const newGate = await tx.gatePass.update({
        where: { id: gatePass.id },
        data: {
          status: GatePassStatus.ISSUED,
          issuedAt: now,
        },
      });

      const newTrip = await tx.trip.update({
        where: { id: trip.id },
        data: {
          status: TripStatus.LOADING,
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'GATEPASS_ISSUED',
          entityType: 'GatePass',
          entityId: gatePass.id,
          metadata: {
            gatePassCode: gatePass.code,
            tripCode: trip.code,
          },
        },
      });

      return { gatePass: newGate, trip: newTrip };
    });

    return updated;
  }

  async scanGatePassOut(gatePassId: string, userId?: string | null) {
    const prisma = this.prisma;

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const gatePass = await tx.gatePass.findFirst({
        where: {
          id: gatePassId,
          tenantId: this.tenantId,
        },
      });

      if (!gatePass) {
        throw new Error('Gate pass not found');
      }

      const trip = await tx.trip.findFirst({
        where: {
          id: gatePass.tripId,
          tenantId: this.tenantId,
        },
      });

      if (!trip) {
        throw new Error('Trip not found for gate pass');
      }

      const newGate = await tx.gatePass.update({
        where: { id: gatePass.id },
        data: {
          status: GatePassStatus.SCANNED_OUT,
          scannedOutAt: now,
        },
      });

      const newTrip = await tx.trip.update({
        where: { id: trip.id },
        data: {
          status: TripStatus.DISPATCHED,
          dispatchedAt: now,
        },
      });

      await tx.systemLog.create({
        data: {
          tenantId: this.tenantId,
          userId: userId ?? null,
          action: 'GATEPASS_SCANNED_OUT',
          entityType: 'GatePass',
          entityId: gatePass.id,
          metadata: {
            gatePassCode: gatePass.code,
            tripCode: trip.code,
          },
        },
      });

      return { gatePass: newGate, trip: newTrip };
    });

    return updated;
  }
}