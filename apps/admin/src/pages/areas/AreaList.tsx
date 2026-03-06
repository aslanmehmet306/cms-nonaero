import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Building2,
  Layers,
  Grid3X3,
  MapPin,
  Gauge,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  getAreaRoots,
  createArea,
  createMeter,
  deleteMeter,
  type Area,
  type CreateAreaPayload,
} from '@/api/areas';
import { useAuthStore } from '@/store/authStore';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AREA_TYPE_LABELS: Record<string, string> = {
  terminal: 'Terminal',
  floor: 'Kat',
  zone: 'Bölge',
  unit: 'Ünite',
};

const AREA_TYPE_ICONS: Record<string, typeof Building2> = {
  terminal: Building2,
  floor: Layers,
  zone: Grid3X3,
  unit: MapPin,
};

const CHILD_TYPE: Record<string, string> = {
  terminal: 'floor',
  floor: 'zone',
  zone: 'unit',
};

const UNIT_CLASSIFICATION_LABELS: Record<string, string> = {
  commercial: 'Ticari',
  food_beverage: 'Yiyecek & İçecek',
  bank: 'Banka',
  rent_a_car: 'Rent a Car',
  office: 'Ofis',
  storage: 'Depo',
  lounge: 'Lounge',
  duty_free: 'Duty Free',
  other: 'Diğer',
};

const METER_TYPE_LABELS: Record<string, string> = {
  electricity: 'Elektrik',
  water: 'Su',
  gas: 'Doğalgaz',
  heating: 'Isıtma',
};

/* ------------------------------------------------------------------ */
/*  Tree row                                                           */
/* ------------------------------------------------------------------ */

function AreaTreeRow({
  area,
  depth,
  onAddChild,
  onAddMeter,
  onDeleteMeter,
}: {
  area: Area;
  depth: number;
  onAddChild: (parent: Area) => void;
  onAddMeter: (area: Area) => void;
  onDeleteMeter: (meterId: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = area.children && area.children.length > 0;
  const hasMeters = area.meters && area.meters.length > 0;
  const Icon = AREA_TYPE_ICONS[area.areaType] ?? MapPin;
  const canAddChild = area.areaType !== 'unit';
  const isUnit = area.areaType === 'unit';

  return (
    <>
      <tr className="group border-b hover:bg-muted/50 transition-colors">
        <td className="py-2 pr-2" style={{ paddingLeft: `${depth * 24 + 8}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren || hasMeters ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-0.5 rounded hover:bg-muted"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm">{area.name}</span>
            {isUnit && area.unitClassification && (
              <Badge variant="secondary" className="text-xs ml-1">
                {UNIT_CLASSIFICATION_LABELS[area.unitClassification] ?? area.unitClassification}
              </Badge>
            )}
          </div>
        </td>
        <td className="py-2 px-3">
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{area.code}</code>
        </td>
        <td className="py-2 px-3">
          <Badge variant="outline" className="text-xs">
            {AREA_TYPE_LABELS[area.areaType] ?? area.areaType}
          </Badge>
        </td>
        <td className="py-2 px-3 text-sm text-muted-foreground">
          {area.areaM2 ? `${area.areaM2} m²` : '-'}
          {isUnit && area.heightM ? ` / ${area.heightM} m` : ''}
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1">
            {area.isLeasable && (
              <Badge variant="secondary" className="text-xs">
                Kiralanabilir
              </Badge>
            )}
            {hasMeters && (
              <Badge variant="outline" className="text-xs">
                <Gauge className="h-3 w-3 mr-1" />
                {area.meters!.length} sayaç
              </Badge>
            )}
          </div>
        </td>
        <td className="py-2 px-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {isUnit && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onAddMeter(area)}
              >
                <Gauge className="h-3 w-3 mr-1" />
                Sayaç
              </Button>
            )}
            {canAddChild && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onAddChild(area)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {AREA_TYPE_LABELS[CHILD_TYPE[area.areaType]] ?? 'Ekle'}
              </Button>
            )}
          </div>
        </td>
      </tr>
      {/* Meters sub-rows */}
      {expanded && hasMeters && area.meters!.map((meter) => (
        <tr key={meter.id} className="group border-b bg-muted/20">
          <td className="py-1.5 pr-2" style={{ paddingLeft: `${(depth + 1) * 24 + 8}px` }}>
            <div className="flex items-center gap-2">
              <span className="w-5" />
              <Gauge className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="text-xs text-muted-foreground">
                {METER_TYPE_LABELS[meter.meterType] ?? meter.meterType}
              </span>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{meter.serialNumber}</code>
              {meter.location && (
                <span className="text-xs text-muted-foreground">— {meter.location}</span>
              )}
            </div>
          </td>
          <td colSpan={4} />
          <td className="py-1.5 px-3 text-right">
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-destructive"
              onClick={() => onDeleteMeter(meter.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </td>
        </tr>
      ))}
      {expanded &&
        hasChildren &&
        area.children!.map((child) => (
          <AreaTreeRow
            key={child.id}
            area={child}
            depth={depth + 1}
            onAddChild={onAddChild}
            onAddMeter={onAddMeter}
            onDeleteMeter={onDeleteMeter}
          />
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Create area dialog schema                                          */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  areaType: z.string().min(1, 'Tip seçiniz'),
  terminalId: z.string().optional(),
  floorId: z.string().optional(),
  zoneId: z.string().optional(),
  code: z.string().min(1, 'Kod gerekli'),
  name: z.string().min(1, 'Ad gerekli'),
  areaM2: z.string().optional(),
  heightM: z.string().optional(),
  unitClassification: z.string().optional(),
  isLeasable: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

/* ------------------------------------------------------------------ */
/*  Add meter dialog schema                                            */
/* ------------------------------------------------------------------ */

const meterSchema = z.object({
  serialNumber: z.string().min(1, 'Seri no gerekli'),
  meterType: z.string().min(1, 'Sayaç tipi seçiniz'),
  location: z.string().optional(),
});

type MeterFormValues = z.infer<typeof meterSchema>;

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export function AreaList() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const airportId = user?.airportId ?? 'default';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [meterDialogOpen, setMeterDialogOpen] = useState(false);
  const [meterTargetArea, setMeterTargetArea] = useState<Area | null>(null);

  const { data: roots, isLoading } = useQuery({
    queryKey: ['area-roots', airportId],
    queryFn: () => getAreaRoots({ airportId }),
  });

  const terminals = roots ?? [];

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      areaType: '',
      terminalId: '',
      floorId: '',
      zoneId: '',
      code: '',
      name: '',
      areaM2: '',
      heightM: '',
      unitClassification: '',
      isLeasable: '',
    },
  });

  const meterForm = useForm<MeterFormValues>({
    resolver: zodResolver(meterSchema),
    defaultValues: { serialNumber: '', meterType: '', location: '' },
  });

  const selectedAreaType = form.watch('areaType');
  const selectedTerminalId = form.watch('terminalId');
  const selectedFloorId = form.watch('floorId');

  // Cascading data
  const floors = useMemo(() => {
    if (!selectedTerminalId) return [];
    const terminal = terminals.find((t) => t.id === selectedTerminalId);
    return terminal?.children ?? [];
  }, [terminals, selectedTerminalId]);

  const zones = useMemo(() => {
    if (!selectedFloorId) return [];
    const floor = floors.find((f) => f.id === selectedFloorId);
    return floor?.children ?? [];
  }, [floors, selectedFloorId]);

  // Which parent selects to show based on type
  const needsTerminal = selectedAreaType === 'floor' || selectedAreaType === 'zone' || selectedAreaType === 'unit';
  const needsFloor = selectedAreaType === 'zone' || selectedAreaType === 'unit';
  const needsZone = selectedAreaType === 'unit';
  const isUnitType = selectedAreaType === 'unit';

  const invalidateAreas = () => queryClient.invalidateQueries({ queryKey: ['area-roots'] });

  const createMutation = useMutation({
    mutationFn: (payload: CreateAreaPayload) => createArea(payload),
    onSuccess: () => {
      invalidateAreas();
      toast.success('Alan oluşturuldu');
      setDialogOpen(false);
      form.reset();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Alan oluşturulamadı';
      toast.error(msg);
    },
  });

  const createMeterMutation = useMutation({
    mutationFn: (payload: { areaId: string; serialNumber: string; meterType: string; location?: string }) =>
      createMeter(payload),
    onSuccess: () => {
      invalidateAreas();
      toast.success('Sayaç eklendi');
      setMeterDialogOpen(false);
      meterForm.reset();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Sayaç eklenemedi';
      toast.error(msg);
    },
  });

  const deleteMeterMutation = useMutation({
    mutationFn: (meterId: string) => deleteMeter(meterId),
    onSuccess: () => {
      invalidateAreas();
      toast.success('Sayaç silindi');
    },
  });

  function openCreateDialog(presetType?: string, parent?: Area) {
    form.reset({
      areaType: presetType ?? '',
      terminalId: '',
      floorId: '',
      zoneId: '',
      code: '',
      name: '',
      areaM2: '',
      heightM: '',
      unitClassification: '',
      isLeasable: '',
    });

    // Pre-fill cascading selects if adding a child from tree row
    if (parent) {
      const childType = CHILD_TYPE[parent.areaType];
      if (childType) form.setValue('areaType', childType);

      if (parent.areaType === 'terminal') {
        form.setValue('terminalId', parent.id);
      } else if (parent.areaType === 'floor') {
        const term = terminals.find((t) =>
          t.children?.some((f) => f.id === parent.id),
        );
        if (term) form.setValue('terminalId', term.id);
        setTimeout(() => form.setValue('floorId', parent.id), 0);
      } else if (parent.areaType === 'zone') {
        for (const term of terminals) {
          for (const fl of term.children ?? []) {
            if (fl.children?.some((z) => z.id === parent.id)) {
              form.setValue('terminalId', term.id);
              setTimeout(() => {
                form.setValue('floorId', fl.id);
                setTimeout(() => form.setValue('zoneId', parent.id), 0);
              }, 0);
            }
          }
        }
      }
    }

    setDialogOpen(true);
  }

  function openMeterDialog(area: Area) {
    setMeterTargetArea(area);
    meterForm.reset({ serialNumber: '', meterType: '', location: '' });
    setMeterDialogOpen(true);
  }

  function onSubmit(values: CreateFormValues) {
    const parentId =
      values.areaType === 'unit'
        ? values.zoneId
        : values.areaType === 'zone'
          ? values.floorId
          : values.areaType === 'floor'
            ? values.terminalId
            : undefined;

    const payload: CreateAreaPayload = {
      airportId,
      code: values.code,
      name: values.name,
      areaType: values.areaType,
      ...(parentId ? { parentAreaId: parentId } : {}),
      ...(values.areaM2 && values.areaM2.trim() !== ''
        ? { areaM2: Number(values.areaM2) }
        : {}),
      ...(values.heightM && values.heightM.trim() !== ''
        ? { heightM: Number(values.heightM) }
        : {}),
      ...(values.unitClassification && values.unitClassification.trim() !== ''
        ? { unitClassification: values.unitClassification }
        : {}),
      isLeasable: values.isLeasable === 'true',
    };

    createMutation.mutate(payload);
  }

  function onMeterSubmit(values: MeterFormValues) {
    if (!meterTargetArea) return;
    createMeterMutation.mutate({
      areaId: meterTargetArea.id,
      serialNumber: values.serialNumber,
      meterType: values.meterType,
      ...(values.location ? { location: values.location } : {}),
    });
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Alanlar"
        description="Terminal, kat, bölge ve ünite yönetimi"
        actions={
          <Button onClick={() => openCreateDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni Alan Ekle
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Yükleniyor...</p>
      ) : !terminals.length ? (
        <p className="text-muted-foreground">Henüz alan oluşturulmamış.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="py-2 px-2 text-left text-xs font-medium text-muted-foreground">
                  Ad
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                  Kod
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                  Tip
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                  Boyut
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                  Durum
                </th>
                <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody>
              {terminals.map((terminal) => (
                <AreaTreeRow
                  key={terminal.id}
                  area={terminal}
                  depth={0}
                  onAddChild={(parent) => openCreateDialog(undefined, parent)}
                  onAddMeter={openMeterDialog}
                  onDeleteMeter={(id) => deleteMeterMutation.mutate(id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Area Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAreaType
                ? `Yeni ${AREA_TYPE_LABELS[selectedAreaType] ?? 'Alan'}`
                : 'Yeni Alan Ekle'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* 1. Type selector */}
              <FormField
                control={form.control}
                name="areaType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tip</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue('terminalId', '');
                        form.setValue('floorId', '');
                        form.setValue('zoneId', '');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Ne eklemek istiyorsunuz?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="terminal">Terminal</SelectItem>
                        <SelectItem value="floor">Kat</SelectItem>
                        <SelectItem value="zone">Bölge</SelectItem>
                        <SelectItem value="unit">Ünite</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 2. Terminal select */}
              {needsTerminal && (
                <FormField
                  control={form.control}
                  name="terminalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terminal</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue('floorId', '');
                          form.setValue('zoneId', '');
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Terminal seçiniz" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {terminals.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} ({t.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* 3. Floor select */}
              {needsFloor && selectedTerminalId && (
                <FormField
                  control={form.control}
                  name="floorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kat</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue('zoneId', '');
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Kat seçiniz" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {floors.length > 0 ? (
                            floors.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name} ({f.code})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="" disabled>
                              Bu terminalde kat yok
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* 4. Zone select */}
              {needsZone && selectedFloorId && (
                <FormField
                  control={form.control}
                  name="zoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bölge</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Bölge seçiniz" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {zones.length > 0 ? (
                            zones.map((z) => (
                              <SelectItem key={z.id} value={z.id}>
                                {z.name} ({z.code})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="" disabled>
                              Bu katta bölge yok
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kod</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn: DOM-G-R-005" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ad</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn: Duty Free Ana Mağaza" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit classification — only for units */}
              {isUnitType && (
                <FormField
                  control={form.control}
                  name="unitClassification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ünite Sınıfı</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sınıf seçiniz" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(UNIT_CLASSIFICATION_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="areaM2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alan (m²)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="250.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Height — only for units */}
                {isUnitType ? (
                  <FormField
                    control={form.control}
                    name="heightM"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Yükseklik (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="3.50"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div />
                )}
              </div>

              <FormField
                control={form.control}
                name="isLeasable"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value === 'true'}
                        onChange={(e) =>
                          field.onChange(e.target.checked ? 'true' : '')
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Kiralanabilir alan</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  İptal
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Meter Dialog */}
      <Dialog open={meterDialogOpen} onOpenChange={setMeterDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              Sayaç Ekle — {meterTargetArea?.name}
            </DialogTitle>
          </DialogHeader>
          <Form {...meterForm}>
            <form onSubmit={meterForm.handleSubmit(onMeterSubmit)} className="space-y-4">
              <FormField
                control={meterForm.control}
                name="meterType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sayaç Tipi</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Tip seçiniz" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(METER_TYPE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={meterForm.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seri No</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn: ELK-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={meterForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konum (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn: Ana pano - Zemin kat" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMeterDialogOpen(false)}
                >
                  İptal
                </Button>
                <Button type="submit" disabled={createMeterMutation.isPending}>
                  {createMeterMutation.isPending ? 'Ekleniyor...' : 'Ekle'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
