import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { getAirports, updateAirport } from '@/api/airports';

const airportSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  timezone: z.string().min(1, 'Timezone is required'),
});

type AirportFormValues = z.infer<typeof airportSchema>;

export function AirportConfigTab() {
  const queryClient = useQueryClient();

  const { data: airports, isLoading } = useQuery({
    queryKey: ['airports'],
    queryFn: () => getAirports(),
    staleTime: 60_000,
  });

  // Single airport for demo (ADB)
  const airport = airports?.[0];

  const form = useForm<AirportFormValues>({
    resolver: zodResolver(airportSchema),
    values: airport
      ? {
          name: airport.name,
          city: airport.city,
          country: airport.country,
          timezone: airport.timezone,
        }
      : {
          name: '',
          city: '',
          country: '',
          timezone: '',
        },
  });

  const updateMutation = useMutation({
    mutationFn: (data: AirportFormValues) =>
      updateAirport(airport!.id, data),
    onSuccess: () => {
      toast.success('Airport configuration updated');
      queryClient.invalidateQueries({ queryKey: ['airports'] });
    },
    onError: () => toast.error('Failed to update airport configuration'),
  });

  function onSubmit(values: AirportFormValues) {
    updateMutation.mutate(values);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!airport) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border">
        <p className="text-muted-foreground">No airport configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Airport Details (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Airport Details</CardTitle>
          <CardDescription>
            {airport.name} ({airport.iataCode})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">
            <div>
              <span className="text-muted-foreground">IATA Code:</span>{' '}
              <span className="font-mono font-medium">{airport.iataCode}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ICAO Code:</span>{' '}
              <span className="font-mono font-medium">{airport.icaoCode}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Timezone:</span>{' '}
              <span className="font-medium">{airport.timezone}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Airport</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Airport Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Europe/Istanbul" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
