import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type VehicleDto = {
  registration: string;
  driverName?: string | null;
};

type GatePassDto = {
  id: string;
  code: string;
  status: 'DRAFT' | 'ISSUED' | 'SCANNED_OUT' | 'RETURNED';
  fromLocationId: string;
  toLocationId: string;
};

type TripInvoiceDto = {
  invoice: {
    id: string;
    invoiceNo: string;
    status: string;
  };
};

type TripDto = {
  id: string;
  code: string;
  status: 'PLANNED' | 'LOADING' | 'DISPATCHED' | 'DELIVERED' | 'RETURNED';
  plannedDate: string;
  vehicle: VehicleDto;
  gatePasses: GatePassDto[];
  tripInvoices?: TripInvoiceDto[];
};

type TripsResponse = {
  trips: TripDto[];
};

export function TripsPage() {
  const [vehicleRegistration, setVehicleRegistration] = React.useState('');
  const [driverName, setDriverName] = React.useState('');
  const [driverPhone, setDriverPhone] = React.useState('');
  const [fromLocationCode, setFromLocationCode] = React.useState('');
  const [toLocationCode, setToLocationCode] = React.useState('');
  const [plannedDate, setPlannedDate] = React.useState('');
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['logisticsTrips'],
    queryFn: async () => {
      const res = await apiClient.get<TripsResponse>('/logistics/trips');
      return res.data.trips ?? [];
    },
    staleTime: 30_000,
  });

  const createTripMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        vehicleRegistration: vehicleRegistration.trim(),
        fromLocationCode: fromLocationCode.trim(),
        toLocationCode: toLocationCode.trim(),
      };
      if (driverName.trim()) payload.driverName = driverName.trim();
      if (driverPhone.trim()) payload.driverPhone = driverPhone.trim();
      if (plannedDate && !Number.isNaN(Date.parse(plannedDate))) {
        payload.plannedDate = plannedDate;
      }
      const res = await apiClient.post('/logistics/trips', payload);
      return res.data;
    },
    onSuccess: async () => {
      setVehicleRegistration('');
      setDriverName('');
      setDriverPhone('');
      setFromLocationCode('');
      setToLocationCode('');
      setPlannedDate('');
      await queryClient.invalidateQueries({ queryKey: ['logisticsTrips'] });
    },
  });

  const issueMutation = useMutation({
    mutationFn: async (gatePassId: string) => {
      const res = await apiClient.post(`/logistics/gate-passes/${gatePassId}/issue`, {});
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['logisticsTrips'] });
    },
  });

  const scanOutMutation = useMutation({
    mutationFn: async (gatePassId: string) => {
      const res = await apiClient.post(
        `/logistics/gate-passes/${gatePassId}/scan-out`,
        {},
      );
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['logisticsTrips'] });
    },
  });

  const handleCreateTrip = async () => {
    if (!vehicleRegistration.trim() || !fromLocationCode.trim() || !toLocationCode.trim()) {
      alert('Vehicle registration and both location codes are required.');
      return;
    }
    try {
      await createTripMutation.mutateAsync();
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to create trip. Check details and try again.',
      );
    }
  };

  const trips = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Trips &amp; Gate Passes
          </h1>
          <p className="text-xs text-muted-foreground">
            Lightweight logistics view for planning trips and issuing gate passes.
          </p>
        </div>
      </div>

      <Card className="p-4 text-xs space-y-3">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Vehicle registration
            </div>
            <Input
              placeholder="e.g. KAB 123A"
              value={vehicleRegistration}
              onChange={(e) => setVehicleRegistration(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Driver name (optional)
            </div>
            <Input
              placeholder="Driver name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Driver phone (optional)
            </div>
            <Input
              placeholder="Phone"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              From / To location codes
            </div>
            <div className="flex gap-1">
              <Input
                placeholder="From code"
                value={fromLocationCode}
                onChange={(e) => setFromLocationCode(e.target.value)}
                className="h-8"
              />
              <Input
                placeholder="To code"
                value={toLocationCode}
                onChange={(e) => setToLocationCode(e.target.value)}
                className="h-8"
              />
            </div>
            <p className="text-[0.65rem] text-muted-foreground">
              Use existing Location codes (e.g. MAIN, YARD).
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Planned date
            </div>
            <Input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="h-8"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                disabled={createTripMutation.isLoading}
                onClick={handleCreateTrip}
              >
                {createTripMutation.isLoading ? 'Creating...' : 'Create Trip'}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">
              Loading trips...
            </div>
          ) : isError ? (
            <div className="text-xs text-rose-600">
              Failed to load trips.
            </div>
          ) : trips.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No trips yet. Create one above to get started.
            </div>
          ) : (
            <div className="max-h-80 overflow-auto rounded-md border border-border bg-background">
              <table className="w-full border-collapse text-[0.7rem]">
                <thead className="sticky top-0 bg-muted/70">
                  <tr>
                    <th className="border-b border-border px-2 py-1 text-left">
                      Trip
                    </th>
                    <th className="border-b border-border px-2 py-1 text-left">
                      Vehicle
                    </th>
                    <th className="border-b border-border px-2 py-1 text-left">
                      Invoices
                    </th>
                    <th className="border-b border-border px-2 py-1 text-left">
                      Gate Pass
                    </th>
                    <th className="border-b border-border px-2 py-1 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => {
                    const gate = trip.gatePasses[0];
                    const invoices = trip.tripInvoices ?? [];
                    return (
                      <tr key={trip.id} className="border-b border-border/50">
                        <td className="px-2 py-1 align-top">
                          <div className="font-medium text-foreground">
                            {trip.code}
                          </div>
                          <div className="text-[0.65rem] text-muted-foreground">
                            Planned:{' '}
                            {new Date(trip.plannedDate).toLocaleDateString()}
                          </div>
                          <div className="mt-1 text-[0.65rem] text-muted-foreground">
                            Status:{' '}
                            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 capitalize">
                              {trip.status.toLowerCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="font-medium text-foreground">
                            {trip.vehicle?.registration}
                          </div>
                          {trip.vehicle?.driverName && (
                            <div className="text-[0.65rem] text-muted-foreground">
                              {trip.vehicle.driverName}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1 align-top">
                          {invoices.length === 0 ? (
                            <span className="text-[0.65rem] text-muted-foreground">
                              No invoices attached
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-[0.65rem] text-muted-foreground">
                                {invoices.length} invoice
                                {invoices.length > 1 ? 's' : ''}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {invoices.slice(0, 3).map((ti) => (
                                  <span
                                    key={ti.invoice.id}
                                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem]"
                                  >
                                    {ti.invoice.invoiceNo}
                                  </span>
                                ))}
                                {invoices.length > 3 && (
                                  <span className="text-[0.65rem] text-muted-foreground">
                                    +{invoices.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1 align-top">
                          {gate ? (
                            <div className="space-y-1">
                              <div className="font-mono text-[0.65rem]">
                                {gate.code}
                              </div>
                              <div className="text-[0.65rem] text-muted-foreground capitalize">
                                {gate.status.toLowerCase()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[0.65rem] text-muted-foreground">
                              No gate pass
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 align-top text-right space-y-1">
                          {gate && gate.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[0.7rem]"
                              disabled={issueMutation.isLoading}
                              onClick={() =>
                                issueMutation.mutate(gate.id)
                              }
                            >
                              {issueMutation.isLoading ? 'Issuing...' : 'Issue'}
                            </Button>
                          )}
                          {gate && gate.status === 'ISSUED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[0.7rem]"
                              disabled={scanOutMutation.isLoading}
                              onClick={() =>
                                scanOutMutation.mutate(gate.id)
                              }
                            >
                              {scanOutMutation.isLoading
                                ? 'Scanning...'
                                : 'Scan Out'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}