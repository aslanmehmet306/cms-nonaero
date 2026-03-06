import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  AlertCircle,
  TrendingUp,
  Building2,
  FileText,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getDashboard,
  getRevenueSummary,
  getAgingReport,
  type DashboardData,
  type RevenueSummaryData,
  type AgingReportData,
} from '@/api/reports';

function formatCurrencyValue(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

function KpiCard({ title, value, icon }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  );
}

function KpiSection({ data }: { data?: DashboardData }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  const kpis: KpiCardProps[] = [
    {
      title: 'Total Revenue',
      value: formatCurrencyValue(data.totalRevenue),
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: 'Outstanding Invoices',
      value: data.outstandingInvoices.toLocaleString(),
      icon: <AlertCircle className="h-5 w-5" />,
    },
    {
      title: 'Collection Rate',
      value: formatPercentage(data.collectionRate),
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: 'Active Tenants',
      value: data.activeTenants.toLocaleString(),
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      title: 'Active Contracts',
      value: data.activeContracts.toLocaleString(),
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: 'Pending Obligations',
      value: data.pendingObligations.toLocaleString(),
      icon: <Clock className="h-5 w-5" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}

function RevenueChart({ data }: { data?: RevenueSummaryData }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Service Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.items.map((item) => ({
    name: item.label
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    revenue: item.amount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Service Type</CardTitle>
        {data.warning && (
          <p className="text-sm text-amber-600">{data.warning}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value: number) =>
                  new Intl.NumberFormat('en-US', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(value)
                }
              />
              <Tooltip
                formatter={(value: number | undefined) => [
                  formatCurrencyValue(value ?? 0),
                  'Revenue',
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Bar
                dataKey="revenue"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function AgingTable({ data }: { data?: AgingReportData }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aging Report</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const buckets = [
    { label: 'Current', value: data.current },
    { label: '30 Days', value: data.days30 },
    { label: '60 Days', value: data.days60 },
    { label: '90 Days', value: data.days90 },
    { label: '90+ Days', value: data.days90plus },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aging Report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {buckets.map((b) => (
                  <TableHead key={b.label}>{b.label}</TableHead>
                ))}
                <TableHead className="font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                {buckets.map((b) => (
                  <TableCell key={b.label}>
                    {formatCurrencyValue(b.value)}
                  </TableCell>
                ))}
                <TableCell className="font-bold">
                  {formatCurrencyValue(data.total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(),
    staleTime: 60_000,
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-summary', { groupBy: 'service_type' }],
    queryFn: () => getRevenueSummary({ groupBy: 'service_type' }),
    staleTime: 60_000,
  });

  const { data: aging, isLoading: agingLoading } = useQuery({
    queryKey: ['aging-report'],
    queryFn: () => getAgingReport(),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Airport revenue management overview"
      />

      {/* KPI Cards */}
      <KpiSection data={dashboardLoading ? undefined : dashboard} />

      {/* Revenue Chart */}
      <RevenueChart data={revenueLoading ? undefined : revenue} />

      {/* Aging Report */}
      <AgingTable data={agingLoading ? undefined : aging} />
    </div>
  );
}
