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
  type Area,
  type CreateAreaPayload,
} from '@/api/areas';
import { useAuthStore } from '@/store/authStore';

/* ------------------------------------------------------------------ */
/*  Hierarchy helpers                                                  */
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

/* ------------------------------------------------------------------ */
/*  Tree row                                                           */
/* ------------------------------------------------------------------ */

function AreaTreeRow({
  area,
  depth,
  onAddChild,
}: {
  area: Area;
  depth: number;
  onAddChild: (parent: Area) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = area.children && area.children.length > 0;
  const Icon = AREA_TYPE_ICONS[area.areaType] ?? MapPin;
  const canAddChild = area.areaType !== 'unit';

  return (
    <>
      <tr className="group border-b hover:bg-muted/50 transition-colors">
        <td className="py-2 pr-2" style={{ paddingLeft: `${depth * 24 + 8}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
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
        </td>
        <td className="py-2 px-3">
          {area.isLeasable && (
            <Badge variant="secondary" className="text-xs">
              Kiralanabilir
            </Badge>
          )}
        </td>
        <td className="py-2 px-3 text-right">
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
        </td>
      </tr>
      {expanded &&
        hasChildren &&
        area.children!.map((child) => (
          <AreaTreeRow
            key={child.id}
            area={child}
            depth={depth + 1}
            onAddChild={onAddChild}
          />
        ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Create dialog schema                                               */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  areaType: z.string().min(1, 'Tip seçiniz'),
  terminalId: z.string().optional(),
  floorId: z.string().optional(),
  zoneId: z.string().optional(),
  code: z.string().min(1, 'Kod gerekli'),
  name: z.string().min(1, 'Ad gerekli'),
  areaM2: z.string().optional(),
  isLeasable: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export function AreaList() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const airportId = user?.airportId ?? 'default';

  const [dialogOpen, setDialogOpen] = useState(false);

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
      isLeasable: '',
    },
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

  // Determine parent based on type selection
  const resolvedParentId = useMemo(() => {
    if (selectedAreaType === 'unit') return form.getValues('zoneId') || undefined;
    if (selectedAreaType === 'zone') return selectedFloorId || undefined;
    if (selectedAreaType === 'floor') return selectedTerminalId || undefined;
    return undefined; // terminal has no parent
  }, [selectedAreaType, selectedTerminalId, selectedFloorId, form]);

  // Which parent selects to show based on type
  const needsTerminal = selectedAreaType === 'floor' || selectedAreaType === 'zone' || selectedAreaType === 'unit';
  const needsFloor = selectedAreaType === 'zone' || selectedAreaType === 'unit';
  const needsZone = selectedAreaType === 'unit';

  const createMutation = useMutation({
    mutationFn: (payload: CreateAreaPayload) => createArea(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['area-roots'] });
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

  function openCreateDialog(presetType?: string, parent?: Area) {
    form.reset({
      areaType: presetType ?? '',
      terminalId: '',
      floorId: '',
      zoneId: '',
      code: '',
      name: '',
      areaM2: '',
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

  function onSubmit(values: CreateFormValues) {
    // For unit type, zoneId is the parent — grab fresh value
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
      isLeasable: values.isLeasable === 'true',
    };

    createMutation.mutate(payload);
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
                  Alan (m²)
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

              {/* 2. Terminal select — for floor, zone, unit */}
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

              {/* 3. Floor select — for zone, unit */}
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

              {/* 4. Zone select — for unit */}
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
    </div>
  );
}
