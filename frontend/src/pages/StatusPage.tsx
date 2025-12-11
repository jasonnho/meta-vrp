// src/pages/StatusPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Api } from '../lib/api'
import type { HistoryItem, JobDetail, JobVehicle, JobRouteStep } from '../types'
import { useStatusUI } from '../stores/status'
import StatusBadge from '../components/StatusBadge'
import { format } from 'date-fns'

// --- SHADCN UI ---
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

// --- ICONS ---
import {
  Loader2,
  Truck,
  Save,
  ClipboardList,
  AlertCircle,
  ExternalLink,
  Settings2,
  Route,
  Check,
  Inbox,
} from 'lucide-react'

// ✨ motion: framer-motion
import { motion, AnimatePresence } from 'framer-motion'

// --------------------------------------------------

const VEHICLE_STATUS = ['planned', 'in_progress', 'done', 'cancelled'] as const
const STEP_STATUS = ['planned', 'visited', 'skipped', 'failed'] as const

// ✨ motion: variants
// ✨ motion: variants
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
} as const

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
} as const

const stagger = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
} as const

const listItem = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: 6,
    scale: 0.98,
    transition: { duration: 0.15, ease: 'easeInOut' as const },
  },
} as const

export default function StatusPage() {
  const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const { toast } = useToast()

  const { selectedJobId, setSelectedJobId, perVeh, setPerVeh, perStep, setPerStep, clearPicks } =
    useStatusUI()

  const {
    data: jobs = [],
    isLoading: loadingJobs,
    error: jobsErr,
  } = useQuery<HistoryItem[]>({
    queryKey: ['jobs-history'],
    queryFn: Api.listHistory,
    staleTime: 60_000,
    refetchInterval: 30_000,
  })

  const [updatingStepKey, setUpdatingStepKey] = useState<string | null>(null)

  const activeJobs = useMemo(() => {
    return jobs.filter((j) => {
      const status = (j.status ?? '') as string
      return !['succeeded', 'failed', 'cancelled'].includes(status)
    })
  }, [jobs])

  useEffect(() => {
    const q = sp.get('jobId') ?? ''
    if (q && q !== selectedJobId) setSelectedJobId(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const next = new URLSearchParams(sp)
    if (selectedJobId) next.set('jobId', selectedJobId)
    else next.delete('jobId')
    setSp(next, { replace: true })
  }, [selectedJobId, sp, setSp])

  // job detail
  const {
    data: jobDetail,
    isFetching: loadingDetail,
    error: jobErr,
  } = useQuery<JobDetail>({
    queryKey: ['job-detail', selectedJobId],
    queryFn: () => Api.getJobDetail(selectedJobId as string),
    enabled: !!selectedJobId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const vehicles: JobVehicle[] = useMemo(() => jobDetail?.vehicles ?? [], [jobDetail])

  // mutations
  const updateVehicleStatus = useMutation({
    mutationFn: (p: { jobId: string; vid: string | number; status: string }) =>
      Api.assignJobVehicle(p.jobId, p.vid, { status: p.status }),
    onSuccess: () => {
      if (selectedJobId)
        qc.invalidateQueries({
          queryKey: ['job-detail', selectedJobId],
        })
      toast({ title: 'Status Kendaraan Diperbarui' })
    },
    onError: (err: any) => {
      toast({
        title: 'Gagal update kendaraan',
        description: err?.response?.data?.detail ?? err?.message ?? 'Unknown error',
        variant: 'destructive',
      })
    },
  })

  const stepKey = (vid: string | number, seq: number | string) => `${vid}:${seq}`

  const updateStepStatus = useMutation({
    mutationFn: (p: {
      jobId: string
      vid: string | number
      seq: number | string
      status: string
      reason?: string
    }) => {
      const key = stepKey(p.vid, p.seq)
      setUpdatingStepKey(key)
      return Api.updateJobVehicleStepStatus(p.jobId, p.vid, p.seq, {
        status: p.status,
        ...(p.reason ? { reason: p.reason } : {}),
      })
    },
    onSuccess: () => {
      if (selectedJobId)
        qc.invalidateQueries({
          queryKey: ['job-detail', selectedJobId],
        })
      toast({ title: 'Status Langkah Diperbarui' })
    },
    onError: (err: any) => {
      toast({
        title: 'Gagal update langkah',
        description: err?.response?.data?.detail ?? err?.message ?? 'Unknown error',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setUpdatingStepKey(null)
    },
  })

  const calculateProgress = (steps: JobRouteStep[], vehicleStatus?: string): number => {
  // Kalau kendaraan sudah "done", paksa 100%
  if ((vehicleStatus ?? '').toLowerCase() === 'done') return 100

  if (!steps || steps.length === 0) return 0
  const completedStatuses = ['visited', 'skipped', 'failed']
  const completedCount = steps.filter((s) =>
    completedStatuses.includes((s.status ?? '') as string),
  ).length

  return Math.round((completedCount / steps.length) * 100)
}

  return (
    <TooltipProvider>
      {/* ✨ motion: page wrapper */}
      <motion.section className='space-y-6 p-1' {...fadeIn}>
        {/* ====== HEADER ====== */}
        <motion.div
          className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'
          {...fadeUp}
        >
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Update Status Lapangan</h1>
            <p className='text-muted-foreground'>
              Pilih job untuk memantau dan memperbarui status kendaraan serta progres rute.
            </p>
          </div>
          <motion.div
            className='flex-shrink-0 flex items-center gap-3 p-3 border rounded-lg bg-muted/50'
            whileHover={{ y: -1 }}
            transition={{ type: 'tween', duration: 0.18 }}
          >
            <Truck className='h-5 w-5 text-muted-foreground' />
            <span className='font-medium'>Kendaraan:</span>
            <Badge variant='default' className='text-base px-3 py-1'>
              {loadingDetail ? '...' : vehicles.length}
            </Badge>
          </motion.div>
        </motion.div>

        {/* ====== PILIH JOB ====== */}
        <motion.div {...fadeUp}>
          <Card className='transition-shadow'>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-3'>
                <ClipboardList className='h-5 w-5 text-primary' />
                Pilih Job Aktif
              </CardTitle>
              <CardDescription>
                Pilih job yang sedang berjalan atau terencana untuk di-update.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Select
                value={selectedJobId ?? ''}
                onValueChange={(val) => {
                  setSelectedJobId(val)
                  clearPicks()
                }}
                disabled={loadingJobs}
              >
                <SelectTrigger className='w-full text-left'>
                  <SelectValue placeholder='— Pilih job yang akan di-update —' />
                </SelectTrigger>
                <SelectContent>
                  {loadingJobs && (
                    <div className='flex items-center justify-center p-2 text-sm text-muted-foreground'>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Memuat jobs...
                    </div>
                  )}
                  {activeJobs.length === 0 && !loadingJobs && (
                    <div className='p-2 text-sm text-muted-foreground text-center'>
                      Tidak ada job aktif.
                    </div>
                  )}
                  {activeJobs.map((j) => (
                    <SelectItem key={j.job_id} value={j.job_id}>
                      <div className='flex items-center justify-between w-full gap-4'>
                        <span className='font-medium text-sm'>
                          {format(new Date(j.created_at), 'dd MMM yyyy')}
                        </span>
                        <div className='flex items-center gap-2 flex-shrink-0'>
                          <StatusBadge status={(j.status ?? 'planned') as string} />
                          <Badge variant='outline'>{j.vehicle_count} kendaraan</Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {jobsErr && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertTitle>Gagal Memuat Daftar Job</AlertTitle>
                  <AlertDescription>{(jobsErr as Error).message}</AlertDescription>
                </Alert>
              )}
              {selectedJobId && loadingDetail && (
                <Alert className='bg-muted/50'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <AlertTitle>Memuat Detail Job...</AlertTitle>
                  <AlertDescription>
                    Sedang mengambil data kendaraan dan rute untuk Job ID: {selectedJobId}
                  </AlertDescription>
                </Alert>
              )}
              {jobErr && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertTitle>Gagal Memuat Detail Job</AlertTitle>
                  <AlertDescription>{(jobErr as Error).message}</AlertDescription>
                </Alert>
              )}

              <AnimatePresence>
                {selectedJobId && jobDetail && !loadingDetail && !jobErr && (
                  <motion.div
                    className='flex items-center justify-between text-sm text-muted-foreground pt-2'
                    {...fadeIn}
                  >
                    <span>
                      {jobDetail.status} · {new Date(jobDetail.created_at).toLocaleString()}
                    </span>
                    <Link to={`/logs?detail=${selectedJobId}`}>
                      <motion.div whileTap={{ scale: 0.98 }}>
                        <Button variant='outline' size='sm'>
                          <ExternalLink className='mr-2 h-4 w-4' />
                          Lihat Detail Lengkap
                        </Button>
                      </motion.div>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* ====== DAFTAR KENDARAAN ====== */}
        <AnimatePresence>
          {selectedJobId && !loadingDetail && !jobErr && (
            <motion.div {...fadeUp}>
              <Card>
                <CardHeader>
                  <CardTitle className='text-lg'>Update Status Kendaraan</CardTitle>
                  <CardDescription>
                    Klik pada kendaraan untuk melihat dan mengubah status rutenya.
                  </CardDescription>
                </CardHeader>
                <CardContent className='p-0'>
                  {vehicles.length === 0 ? (
                    <motion.div
                      className='p-16 text-muted-foreground text-center space-y-2'
                      {...fadeIn}
                    >
                      <Inbox className='h-12 w-12 mx-auto' />
                      <p className='font-medium'>Tidak Ada Kendaraan</p>
                      <p className='text-sm'>Job ini tidak memiliki alokasi kendaraan.</p>
                    </motion.div>
                  ) : (
                    // ✨ container + stagger untuk kendaraan
                    <motion.div variants={stagger} initial='initial' animate='animate'>
                      <Accordion type='multiple' className='w-full'>
                        {vehicles.map((v) => {
                          const vid = String(v.vehicle_id)
                          const vehPick = perVeh[vid] ?? {}
                          const steps: JobRouteStep[] = Array.isArray(v.route)
  ? [...(v.route as JobRouteStep[])].sort(
      (a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0),
    )
  : []

const vehicleStatus = ((v as any).status ?? 'planned') as string

const vehicleProgress = calculateProgress(steps, vehicleStatus)


                          return (
                            <motion.div key={vid} variants={listItem} layout>
                              <AccordionItem value={vid}>
                                {/* Header */}
                                <AccordionTrigger className='px-6 py-4 hover:no-underline hover:bg-muted/50'>
                                  <div className='flex items-center gap-4 flex-1 min-w-0'>
                                    <Truck className='h-5 w-5 text-primary flex-shrink-0' />
                                    <div className='flex-1 text-left space-y-1'>
                                      <span className='font-bold text-base'>
                                        Vehicle #{v.vehicle_id}
                                      </span>
                                      <div className='flex items-center gap-2'>
                                        <Progress value={vehicleProgress} className='h-2 w-24' />
                                        <span className='text-xs text-muted-foreground'>
                                          {vehicleProgress}% Selesai
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <StatusBadge status={(v as any).status ?? 'planned'} />
                                </AccordionTrigger>

                                {/* Content */}
                                {/* ✨ fade konten saat expand */}
                                <AccordionContent asChild>
                                  <motion.div
                                    className='px-6 py-4 border-t bg-muted/30'
                                    {...fadeIn}
                                  >
                                    <Tabs defaultValue='steps' className='w-full'>
                                      <TabsList className='grid w-full grid-cols-2'>
                                        <TabsTrigger value='steps'>
                                          <Route className='mr-2 h-4 w-4' />
                                          Langkah Rute ({steps.length})
                                        </TabsTrigger>
                                        <TabsTrigger value='vehicle-status'>
                                          <Settings2 className='mr-2 h-4 w-4' />
                                          Status Kendaraan
                                        </TabsTrigger>
                                      </TabsList>

                                      {/* Tab: Steps */}
                                      <TabsContent value='steps' className='pt-4'>
                                        <div className='rounded-md border'>
                                          <ScrollArea className='h-96'>
                                            <div className='p-1'>
                                              {steps.length === 0 ? (
                                                <motion.div
                                                  className='p-8 text-sm text-muted-foreground text-center'
                                                  {...fadeIn}
                                                >
                                                  Tidak ada langkah rute untuk kendaraan ini.
                                                </motion.div>
                                              ) : (
                                                // ✨ stagger untuk daftar step
                                                <motion.div
                                                  variants={stagger}
                                                  initial='initial'
                                                  animate='animate'
                                                >
                                                  {steps.map((s) => {
                                                    const seq = s.sequence_index ?? 0
                                                    const k = `${vid}:${seq}`
                                                    const pickStatus =
                                                      perStep[k]?.status ?? s.status ?? 'planned'
                                                    const pickReason =
                                                      perStep[k]?.reason ?? (s.reason || '')
                                                    const isUpdatingThisStep = updatingStepKey === k

                                                    return (
                                                      <motion.div
                                                        key={k}
                                                        variants={listItem}
                                                        className='p-3 border-b last:border-b-0 space-y-3 bg-background/60'
                                                        whileHover={{
                                                          y: -1,
                                                        }}
                                                      >
                                                        {/* Info Step */}
                                                        <div className='flex items-center justify-between gap-3'>
                                                          <div className='flex items-center gap-3'>
                                                            <Badge
                                                              variant='outline'
                                                              className='text-base font-bold'
                                                            >
                                                              #{seq}
                                                            </Badge>
                                                            <div className='flex-1'>
                                                              <div className='font-mono text-sm font-medium'>
                                                                {String(s.node_id)}
                                                              </div>
                                                              <div className='text-xs'>
                                                                Status Saat Ini:{' '}
                                                                <StatusBadge
                                                                  status={s.status ?? 'planned'}
                                                                />
                                                              </div>
                                                            </div>
                                                          </div>

                                                          {/* Quick mark visited */}
                                                          {s.status === 'planned' && (
                                                            <Tooltip>
                                                              <TooltipTrigger asChild>
                                                                <motion.div
                                                                  whileTap={{
                                                                    scale: 0.98,
                                                                  }}
                                                                >
                                                                  <Button
                                                                    size='icon'
                                                                    variant='outline'
                                                                    className='h-8 w-8'
                                                                    disabled={
                                                                      !!updatingStepKey ||
                                                                      isUpdatingThisStep
                                                                    }
                                                                    onClick={() =>
                                                                      updateStepStatus.mutate({
                                                                        jobId:
                                                                          selectedJobId as string,
                                                                        vid,
                                                                        seq,
                                                                        status: 'visited',
                                                                      })
                                                                    }
                                                                  >
                                                                    {isUpdatingThisStep ? (
                                                                      <Loader2 className='h-4 w-4 animate-spin' />
                                                                    ) : (
                                                                      <Check className='h-4 w-4' />
                                                                    )}
                                                                  </Button>
                                                                </motion.div>
                                                              </TooltipTrigger>
                                                              <TooltipContent>
                                                                Tandai "Visited"
                                                              </TooltipContent>
                                                            </Tooltip>
                                                          )}
                                                        </div>

                                                        {/* Form Update Step */}
                                                        <div className='grid grid-cols-1 sm:grid-cols-3 gap-2 items-end'>
                                                          <div className='space-y-1 w-full sm:w-auto sm:min-w-[150px]'>
                                                            <Label
                                                              htmlFor={`s-status-${k}`}
                                                              className='text-xs'
                                                            >
                                                              Ubah Status
                                                            </Label>
                                                            <Select
                                                              value={pickStatus}
                                                              onValueChange={(val) =>
                                                                setPerStep((st) => ({
                                                                  ...st,
                                                                  [k]: {
                                                                    ...(st[k] ?? {}),
                                                                    status: val,
                                                                  },
                                                                }))
                                                              }
                                                              disabled={
                                                                !!updatingStepKey ||
                                                                isUpdatingThisStep
                                                              }
                                                            >
                                                              <SelectTrigger id={`s-status-${k}`}>
                                                                <SelectValue />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                {STEP_STATUS.map((st) => (
                                                                  <SelectItem
                                                                    key={st}
                                                                    value={st}
                                                                    className='capitalize'
                                                                  >
                                                                    {st}
                                                                  </SelectItem>
                                                                ))}
                                                              </SelectContent>
                                                            </Select>
                                                          </div>

                                                          <div className='space-y-1 w-full flex-1'>
                                                            <Label
                                                              htmlFor={`s-reason-${k}`}
                                                              className='text-xs'
                                                            >
                                                              Alasan (Opsional)
                                                            </Label>
                                                            <Input
                                                              id={`s-reason-${k}`}
                                                              placeholder='Contoh: Taman tutup'
                                                              value={pickReason}
                                                              onChange={(e) =>
                                                                setPerStep((st) => ({
                                                                  ...st,
                                                                  [k]: {
                                                                    ...(st[k] ?? {}),
                                                                    reason: e.target.value,
                                                                  },
                                                                }))
                                                              }
                                                              disabled={
                                                                !!updatingStepKey ||
                                                                isUpdatingThisStep
                                                              }
                                                            />
                                                          </div>

                                                          <motion.div
                                                            whileTap={{
                                                              scale: 0.98,
                                                            }}
                                                          >
                                                            <Button
                                                              size='sm'
                                                              variant='outline'
                                                              disabled={
                                                                !!updatingStepKey ||
                                                                isUpdatingThisStep ||
                                                                updateStepStatus.isPending
                                                              }
                                                              onClick={() =>
                                                                updateStepStatus.mutate({
                                                                  jobId: selectedJobId as string,
                                                                  vid,
                                                                  seq,
                                                                  status: pickStatus,
                                                                  reason: pickReason || undefined,
                                                                })
                                                              }
                                                              className='w-full sm:w-auto'
                                                            >
                                                              {updateStepStatus.isPending ? (
                                                                <Loader2 className='h-4 w-4 animate-spin' />
                                                              ) : (
                                                                'Set'
                                                              )}
                                                            </Button>
                                                          </motion.div>
                                                        </div>
                                                      </motion.div>
                                                    )
                                                  })}
                                                </motion.div>
                                              )}
                                            </div>
                                          </ScrollArea>
                                        </div>
                                      </TabsContent>

                                      {/* Tab: Vehicle Status */}
                                      <TabsContent value='vehicle-status' className='pt-4'>
                                        <motion.div {...fadeIn}>
                                          <Card className='bg-background'>
                                            <CardContent className='p-4 space-y-4'>
                                              <p className='text-sm text-muted-foreground'>
                                                Ubah status keseluruhan untuk Kendaraan #{vid}.
                                              </p>
                                              <div className='space-y-1'>
                                                <Label htmlFor={`v-status-${vid}`}>
                                                  Status Kendaraan
                                                </Label>
                                                <Select
                                                  value={
                                                    vehPick.status ?? (v as any).status ?? 'planned'
                                                  }
                                                  onValueChange={(val) =>
                                                    setPerVeh((s) => ({
                                                      ...s,
                                                      [vid]: {
                                                        ...(s[vid] ?? {}),
                                                        status: val,
                                                      },
                                                    }))
                                                  }
                                                  disabled={updateVehicleStatus.isPending}
                                                >
                                                  <SelectTrigger
                                                    id={`v-status-${vid}`}
                                                    className='w-full sm:w-[240px]'
                                                  >
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {VEHICLE_STATUS.map((st) => (
                                                      <SelectItem
                                                        key={st}
                                                        value={st}
                                                        className='capitalize'
                                                      >
                                                        {st}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              <motion.div
                                                whileTap={{
                                                  scale: 0.98,
                                                }}
                                              >
                                                <Button
                                                  disabled={
                                                    !perVeh[vid]?.status ||
                                                    updateVehicleStatus.isPending
                                                  }
                                                  onClick={() =>
                                                    updateVehicleStatus.mutate({
                                                      jobId: selectedJobId as string,
                                                      vid,
                                                      status:
                                                        perVeh[vid]?.status ??
                                                        (v as any).status ??
                                                        'planned',
                                                    })
                                                  }
                                                >
                                                  {updateVehicleStatus.isPending ? (
                                                    <>
                                                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                      Menyimpan...
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Save className='mr-2 h-4 w-4' />
                                                      Simpan Status Kendaraan
                                                    </>
                                                  )}
                                                </Button>
                                              </motion.div>
                                            </CardContent>
                                          </Card>
                                        </motion.div>
                                      </TabsContent>
                                    </Tabs>
                                  </motion.div>
                                </AccordionContent>
                              </AccordionItem>
                            </motion.div>
                          )
                        })}
                      </Accordion>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </TooltipProvider>
  )
}
