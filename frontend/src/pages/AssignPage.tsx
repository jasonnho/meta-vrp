// src/pages/AssignPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Api } from "../lib/api";
import type {
    Operator,
    Vehicle,
    HistoryItem,
    JobDetail,
    JobVehicle,
} from "../types";
import { useAssignUI } from "../stores/assign";
import StatusBadge from "../components/StatusBadge";
import { format } from "date-fns";

// --- SHADCN UI ---
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// --- ICONS ---
import {
    Loader2,
    Users,
    Truck,
    Save,
    RotateCcw,
    ClipboardList,
    FileCog,
    BookUser,
    AlertCircle,
    MoreHorizontal,
    Trash2,
    Plus,
    ToggleLeft,
    ToggleRight,
    Search,
    Info,
} from "lucide-react";

// ✨ motion: framer-motion
import { motion, AnimatePresence } from "framer-motion";

type PerRVSelection = Record<
    string,
    { operatorId?: string; vehicleId?: string; status?: string }
>;

// const STATUS_OPTIONS = ["planned", "in_progress", "done", "done_with_issues", "cancelled"] as const

// ✨ motion: variants
// ✨ motion: variants
const fadeUp = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
    transition: { duration: 0.22, ease: "easeOut" as const },
} as const;

const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.18 },
} as const;

const staggerContainer = {
    initial: { opacity: 0 },
    animate: {
        opacity: 1,
        transition: { staggerChildren: 0.06, delayChildren: 0.04 },
    },
} as const;

const cardItem = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.22, ease: "easeOut" as const },
    },
    exit: {
        opacity: 0,
        y: 6,
        scale: 0.98,
        transition: { duration: 0.15, ease: "easeInOut" as const },
    },
} as const;

export default function AssignPage() {
    const qc = useQueryClient();
    const [sp, setSp] = useSearchParams();
    const { toast } = useToast();

    // ======= State Lokal untuk Dialog Hapus =======
    const [deletingOperator, setDeletingOperator] = useState<Operator | null>(
        null
    );
    const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(
        null
    );

    // ======= Store (persist) =======
    const {
        selectedJobId,
        setSelectedJobId,
        perRV,
        setPerRV,
        clearPerRV,
        showAddOp,
        setShowAddOp,
        newOp,
        setNewOp,
        showAddVeh,
        setShowAddVeh,
        newVeh,
        setNewVeh,
    } = useAssignUI();

    // --- TAMBAHKAN STATE BARU ---
    const [operatorSearch, setOperatorSearch] = useState("");
    const [vehicleSearch] = useState("");
    const [newOpError, setNewOpError] = useState("");
    const [newVehError, setNewVehError] = useState("");
    // -----------------------------

    // ================== 1) Jobs dropdown ==================
    const {
        data: jobs = [],
        isLoading: loadingJobs,
        error: jobsErr,
    } = useQuery<HistoryItem[]>({
        queryKey: ["jobs-history"],
        queryFn: Api.listHistory,
        staleTime: 60_000,
        gcTime: 10 * 60_000,
    });

    const activeJobs = useMemo(() => {
        return jobs.filter(
            (j) => !["succeeded", "failed", "cancelled"].includes(j.status)
        );
    }, [jobs]);

    // Sinkronisasi selectedJobId <-> URL (?jobId=...) dan toggle add forms (?add=op|veh)
    useEffect(() => {
        const j = sp.get("jobId") ?? "";
        const add = sp.get("add") ?? "";
        if (j && j !== selectedJobId) setSelectedJobId(j);
        if (add === "op") setShowAddOp(true);
        if (add === "veh") setShowAddVeh(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        const next = new URLSearchParams(sp);
        if (selectedJobId) next.set("jobId", selectedJobId);
        else next.delete("jobId");

        if (showAddOp) next.set("add", "op");
        else if (showAddVeh) next.set("add", "veh");
        else next.delete("add");

        setSp(next, { replace: true });
    }, [selectedJobId, showAddOp, showAddVeh, sp, setSp]);

    const selectedJobDetailFromList = useMemo(() => {
        if (!selectedJobId || jobs.length === 0) return null;
        return jobs.find((job) => job.job_id === selectedJobId);
    }, [selectedJobId, jobs]);

    // ================== 2) Job detail (vehicles) ==================
    const {
        data: jobDetail,
        isFetching: loadingDetail,
        error: jobErr,
    } = useQuery<JobDetail>({
        queryKey: ["job-detail", selectedJobId],
        queryFn: () => Api.getJobDetail(selectedJobId),
        enabled: !!selectedJobId,
        staleTime: 30_000,
        refetchInterval: 30_000,
    });

    useEffect(() => {
        clearPerRV();
    }, [selectedJobId, clearPerRV]);

    // ================== 3) Catalogs ==================
    const { data: operators = [], isFetching: fetchingOperators } = useQuery<
        Operator[]
    >({
        queryKey: ["operators"],
        queryFn: Api.listOperators,
        staleTime: 60_000,
    });
    const { data: vehicles = [], isFetching: fetchingVehicles } = useQuery<
        Vehicle[]
    >({
        queryKey: ["vehicles"],
        queryFn: Api.listVehicles,
        staleTime: 60_000,
    });

    const filteredOperators = useMemo(() => {
        const q = operatorSearch.toLowerCase().trim();
        if (!q) return operators;
        return operators.filter(
            (o) =>
                o.name.toLowerCase().includes(q) ||
                o.phone?.toLowerCase().includes(q)
        );
    }, [operators, operatorSearch]);

    const filteredVehicles = useMemo(() => {
        const q = vehicleSearch.toLowerCase().trim();
        if (!q) return vehicles;
        return vehicles.filter((v) => v.plate.toLowerCase().includes(q));
    }, [vehicles, vehicleSearch]);

    // ================== 4) Mutations ==================
    const assignMut = useMutation({
        mutationFn: (p: {
            jobId: string;
            vid: string | number;
            assigned_vehicle_id?: string;
            assigned_operator_id?: string;
            status?: string;
        }) =>
            Api.assignJobVehicle(p.jobId, p.vid, {
                assigned_vehicle_id: p.assigned_vehicle_id,
                assigned_operator_id: p.assigned_operator_id,
                status: p.status,
            }),
        onSuccess: () => {
            if (selectedJobId)
                qc.invalidateQueries({
                    queryKey: ["job-detail", selectedJobId],
                });
            toast({ title: "Tugas kendaraan diperbarui" });
        },
        onError: (err: any) => {
            toast({
                title: "Gagal assign",
                description:
                    err?.response?.data?.detail ??
                    err?.message ??
                    "Unknown error",
                variant: "destructive",
            });
        },
    });

    const updateOp = useMutation({
        mutationFn: (p: {
            id: string;
            patch: Partial<Pick<Operator, "name" | "phone" | "active">>;
        }) => Api.updateOperator(p.id, p.patch),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["operators"] }),
    });
    const deleteOp = useMutation({
        mutationFn: Api.deleteOperator,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["operators"] });
            setDeletingOperator(null);
        },
    });
    const createOp = useMutation({
        mutationFn: (p: { name: string; phone?: string; active?: boolean }) =>
            Api.createOperator({
                name: p.name,
                phone: p.phone,
                active: p.active ?? true,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["operators"] });
            setShowAddOp(false);
            setNewOp(() => ({ name: "", phone: "", active: true }));
            toast({ title: "Operator ditambahkan" });
        },
        onError: (err: any) =>
            toast({
                title: "Gagal menambah operator",
                description:
                    err?.response?.data?.detail ??
                    err?.message ??
                    "Unknown error",
                variant: "destructive",
            }),
    });

    const updateVeh = useMutation({
        mutationFn: (p: {
            id: string;
            patch: Partial<Pick<Vehicle, "plate" | "capacityL" | "active">>;
        }) => Api.updateVehicle(p.id, p.patch),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
    });
    const deleteVeh = useMutation({
        mutationFn: Api.deleteVehicle,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["vehicles"] });
            setDeletingVehicle(null);
        },
    });
    const createVeh = useMutation({
        mutationFn: (p: {
            plate: string;
            capacityL: number;
            active?: boolean;
        }) =>
            Api.createVehicle({
                plate: p.plate,
                capacityL: p.capacityL,
                active: p.active ?? true,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["vehicles"] });
            setShowAddVeh(false);
            setNewVeh(() => ({ plate: "", capacityL: 0, active: true }));
            toast({ title: "Vehicle ditambahkan" });
        },
        onError: (err: any) =>
            toast({
                title: "Gagal menambah vehicle",
                description:
                    err?.response?.data?.detail ??
                    err?.message ??
                    "Unknown error",
                variant: "destructive",
            }),
    });

    // ================== derived ==================
    const jobVehicles: JobVehicle[] = useMemo(
        () => jobDetail?.vehicles ?? [],
        [jobDetail]
    );

    // ================== UI ==================
    return (
        <TooltipProvider>
            {/* ✨ motion: page wrapper */}
            <motion.section className="space-y-6 p-1" {...fadeIn}>
                {/* ====== HEADER HALAMAN ====== */}
                <motion.div
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    {...fadeUp}
                >
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Penugasan & Katalog
                        </h1>
                        <p className="text-muted-foreground">
                            Alokasikan operator dan kendaraan ke job, serta
                            kelola data master.
                        </p>
                    </div>
                </motion.div>

                {/* ====== TABS UTAMA ====== */}
                <Tabs defaultValue="assign" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="assign">
                            <FileCog className="mr-2 h-4 w-4" />
                            Penugasan Job
                        </TabsTrigger>
                        <TabsTrigger value="catalog">
                            <BookUser className="mr-2 h-4 w-4" />
                            Katalog
                        </TabsTrigger>
                    </TabsList>

                    {/* ================= TAB: PENUGASAN JOB ================= */}
                    {/* ✨ motion: AnimatePresence supaya konten tab smooth */}
                    <AnimatePresence mode="wait">
                        <TabsContent
                            value="assign"
                            className="space-y-6 mt-4"
                            asChild
                        >
                            <motion.div key="tab-assign" {...fadeUp}>
                                {/* ======= Pilih Job ======= */}
                                <motion.div {...fadeIn}>
                                    <Card className="transition-shadow">
                                        <CardHeader>
                                            <CardTitle className="text-lg flex items-center gap-3">
                                                <ClipboardList className="h-5 w-5 text-primary" />
                                                Pilih Job Aktif
                                            </CardTitle>
                                            <CardDescription>
                                                Pilih job yang sedang berjalan
                                                atau terencana untuk
                                                dialokasikan.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <Select
                                                value={selectedJobId}
                                                onValueChange={(val) =>
                                                    setSelectedJobId(val)
                                                }
                                                disabled={loadingJobs}
                                            >
                                                <SelectTrigger className="w-full text-left">
                                                    <SelectValue placeholder="— Pilih job yang akan dialokasikan —" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {loadingJobs && (
                                                        <div className="flex items-center justify-center p-2 text-sm text-muted-foreground">
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Memuat jobs...
                                                        </div>
                                                    )}
                                                    {activeJobs.length === 0 &&
                                                        !loadingJobs && (
                                                            <div className="p-2 text-sm text-muted-foreground text-center">
                                                                Tidak ada job
                                                                aktif.
                                                            </div>
                                                        )}
                                                    {activeJobs.map((j) => (
                                                        <SelectItem
                                                            key={j.job_id}
                                                            value={j.job_id}
                                                        >
                                                            <div className="flex items-center justify-between w-full gap-4">
                                                                <span className="font-medium text-sm">
                                                                    {format(
                                                                        new Date(
                                                                            j.created_at
                                                                        ),
                                                                        "dd MMM yyyy"
                                                                    )}
                                                                </span>
                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    <StatusBadge
                                                                        status={
                                                                            j.status
                                                                        }
                                                                    />
                                                                    <Badge variant="outline">
                                                                        {
                                                                            j.vehicle_count
                                                                        }{" "}
                                                                        kendaraan
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {/* Loading/Error States */}
                                            {jobsErr && (
                                                <Alert variant="destructive">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertTitle>
                                                        Gagal Memuat Daftar Job
                                                    </AlertTitle>
                                                    <AlertDescription>
                                                        {
                                                            (jobsErr as Error)
                                                                .message
                                                        }
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            {selectedJobId && loadingDetail && (
                                                <Alert className="bg-muted/50">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <AlertTitle>
                                                        Memuat Detail Job...
                                                    </AlertTitle>
                                                    <AlertDescription>
                                                        Sedang mengambil data
                                                        alokasi untuk Job ID:{" "}
                                                        {selectedJobId}
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            {jobErr && (
                                                <Alert variant="destructive">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertTitle>
                                                        Gagal Memuat Detail Job
                                                    </AlertTitle>
                                                    <AlertDescription>
                                                        {
                                                            (jobErr as Error)
                                                                .message
                                                        }
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </CardContent>
                                    </Card>
                                </motion.div>

                                {/* ======= Daftar RV untuk di-assign ======= */}
                                <AnimatePresence>
                                    {selectedJobId &&
                                        !loadingDetail &&
                                        !jobErr && (
                                            <motion.div
                                                className="space-y-4"
                                                {...fadeIn}
                                            >
                                                <motion.h3
                                                    className="text-lg font-semibold"
                                                    {...fadeUp}
                                                >
                                                    Alokasi Kendaraan Job{" "}
                                                    {selectedJobDetailFromList
                                                        ? format(
                                                              new Date(
                                                                  selectedJobDetailFromList.created_at
                                                              ),
                                                              "dd MMMM yyyy"
                                                          )
                                                        : `(ID: ${selectedJobId.slice(
                                                              0,
                                                              8
                                                          )}...)`}
                                                </motion.h3>

                                                {/* ✨ motion: container + stagger */}
                                                <motion.div
                                                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
                                                    variants={staggerContainer}
                                                    initial="initial"
                                                    animate="animate"
                                                >
                                                    {jobVehicles.map((v) => {
                                                        const rvKey = String(
                                                            v.vehicle_id
                                                        );
                                                        const pick =
                                                            perRV[rvKey] ?? {};
                                                        const canAssign =
                                                            !!pick.operatorId &&
                                                            !!pick.vehicleId;

                                                        const assignedVeh =
                                                            vehicles.find(
                                                                (x) =>
                                                                    String(
                                                                        x.id
                                                                    ) ===
                                                                    String(
                                                                        v.assigned_vehicle_id
                                                                    )
                                                            );
                                                        const assignedOp =
                                                            operators.find(
                                                                (x) =>
                                                                    String(
                                                                        x.id
                                                                    ) ===
                                                                    String(
                                                                        v.assigned_operator_id
                                                                    )
                                                            );

                                                        return (
                                                            // ✨ motion: card item hover micro-interaction
                                                            <motion.div
                                                                key={rvKey}
                                                                variants={
                                                                    cardItem
                                                                }
                                                                whileHover={{
                                                                    y: -2,
                                                                }}
                                                                transition={{
                                                                    type: "tween",
                                                                    duration: 0.18,
                                                                }}
                                                            >
                                                                <Card className="overflow-hidden">
                                                                    <CardHeader className="py-4">
                                                                        <CardTitle className="text-base flex items-center justify-between">
                                                                            <span>
                                                                                RV
                                                                                #
                                                                                {
                                                                                    v.vehicle_id
                                                                                }
                                                                            </span>
                                                                            <StatusBadge
                                                                                status={
                                                                                    v.status ??
                                                                                    "planned"
                                                                                }
                                                                            />
                                                                        </CardTitle>
                                                                        <CardDescription>
                                                                            Estimasi
                                                                            Waktu:{" "}
                                                                            {v.route_total_time_min ??
                                                                                "—"}{" "}
                                                                            min
                                                                        </CardDescription>
                                                                    </CardHeader>

                                                                    <CardContent className="space-y-4">
                                                                        {(assignedVeh ||
                                                                            assignedOp) && (
                                                                            <Alert variant="default">
                                                                                <Info className="h-4 w-4" />
                                                                                <AlertTitle className="text-xs font-semibold">
                                                                                    Saat
                                                                                    Ini
                                                                                    Ditugaskan
                                                                                </AlertTitle>
                                                                                <AlertDescription className="text-xs space-y-0.5">
                                                                                    {assignedVeh && (
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <Truck className="h-3 w-3 flex-shrink-0" />
                                                                                            <span>
                                                                                                <b>
                                                                                                    {
                                                                                                        assignedVeh.plate
                                                                                                    }
                                                                                                </b>{" "}
                                                                                                (
                                                                                                {
                                                                                                    assignedVeh.capacityL
                                                                                                }
                                                                                                L)
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                    {assignedOp && (
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <Users className="h-3 w-3 flex-shrink-0" />
                                                                                            <span>
                                                                                                <b>
                                                                                                    {
                                                                                                        assignedOp.name
                                                                                                    }
                                                                                                </b>
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </AlertDescription>
                                                                            </Alert>
                                                                        )}

                                                                        {/* Form Select */}
                                                                        <div className="space-y-3">
                                                                            <div className="space-y-1.5">
                                                                                <Label
                                                                                    htmlFor={`op-${rvKey}`}
                                                                                >
                                                                                    Operator
                                                                                </Label>
                                                                                <Select
                                                                                    value={
                                                                                        pick.operatorId ??
                                                                                        ""
                                                                                    }
                                                                                    onValueChange={(
                                                                                        val
                                                                                    ) =>
                                                                                        setPerRV(
                                                                                            (
                                                                                                s: PerRVSelection
                                                                                            ) => ({
                                                                                                ...s,
                                                                                                [rvKey]:
                                                                                                    {
                                                                                                        ...s[
                                                                                                            rvKey
                                                                                                        ],
                                                                                                        operatorId:
                                                                                                            val ||
                                                                                                            undefined,
                                                                                                    },
                                                                                            })
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <SelectTrigger
                                                                                        id={`op-${rvKey}`}
                                                                                    >
                                                                                        <SelectValue placeholder="— Pilih Operator —" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {operators
                                                                                            .filter(
                                                                                                (
                                                                                                    o
                                                                                                ) =>
                                                                                                    o.active
                                                                                            )
                                                                                            .map(
                                                                                                (
                                                                                                    o
                                                                                                ) => (
                                                                                                    <SelectItem
                                                                                                        key={
                                                                                                            o.id
                                                                                                        }
                                                                                                        value={
                                                                                                            o.id
                                                                                                        }
                                                                                                    >
                                                                                                        {
                                                                                                            o.name
                                                                                                        }{" "}
                                                                                                        {o.phone
                                                                                                            ? `(${o.phone})`
                                                                                                            : ""}
                                                                                                    </SelectItem>
                                                                                                )
                                                                                            )}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>

                                                                            <div className="space-y-1.5">
                                                                                <Label
                                                                                    htmlFor={`veh-${rvKey}`}
                                                                                >
                                                                                    Kendaraan
                                                                                </Label>
                                                                                <Select
                                                                                    value={
                                                                                        pick.vehicleId ??
                                                                                        ""
                                                                                    }
                                                                                    onValueChange={(
                                                                                        val
                                                                                    ) =>
                                                                                        setPerRV(
                                                                                            (
                                                                                                s: PerRVSelection
                                                                                            ) => ({
                                                                                                ...s,
                                                                                                [rvKey]:
                                                                                                    {
                                                                                                        ...s[
                                                                                                            rvKey
                                                                                                        ],
                                                                                                        vehicleId:
                                                                                                            val ||
                                                                                                            undefined,
                                                                                                    },
                                                                                            })
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <SelectTrigger
                                                                                        id={`veh-${rvKey}`}
                                                                                    >
                                                                                        <SelectValue placeholder="— Pilih Kendaraan —" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {vehicles
                                                                                            .filter(
                                                                                                (
                                                                                                    vv
                                                                                                ) =>
                                                                                                    vv.active
                                                                                            )
                                                                                            .map(
                                                                                                (
                                                                                                    vv
                                                                                                ) => (
                                                                                                    <SelectItem
                                                                                                        key={
                                                                                                            vv.id
                                                                                                        }
                                                                                                        value={
                                                                                                            vv.id
                                                                                                        }
                                                                                                    >
                                                                                                        {
                                                                                                            vv.plate
                                                                                                        }{" "}
                                                                                                        —{" "}
                                                                                                        {
                                                                                                            vv.capacityL
                                                                                                        }

                                                                                                        L
                                                                                                    </SelectItem>
                                                                                                )
                                                                                            )}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        </div>

                                                                        <Separator />

                                                                        <div className="flex gap-2">
                                                                            {/* ✨ motion: subtle press effect */}
                                                                            <motion.div
                                                                                whileTap={{
                                                                                    scale: 0.98,
                                                                                }}
                                                                            >
                                                                                <Button
                                                                                    size="sm"
                                                                                    disabled={
                                                                                        !canAssign ||
                                                                                        assignMut.isPending
                                                                                    }
                                                                                    onClick={() =>
                                                                                        assignMut.mutate(
                                                                                            {
                                                                                                jobId: selectedJobId!,
                                                                                                vid: v.vehicle_id,
                                                                                                assigned_operator_id:
                                                                                                    pick.operatorId!,
                                                                                                assigned_vehicle_id:
                                                                                                    pick.vehicleId!,
                                                                                            }
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    {assignMut.isPending ? (
                                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                    ) : (
                                                                                        <Save className="mr-2 h-4 w-4" />
                                                                                    )}
                                                                                    Assign
                                                                                </Button>
                                                                            </motion.div>

                                                                            <Tooltip>
                                                                                <TooltipTrigger
                                                                                    asChild
                                                                                >
                                                                                    <motion.div
                                                                                        whileTap={{
                                                                                            scale: 0.98,
                                                                                        }}
                                                                                    >
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="outline"
                                                                                            onClick={() =>
                                                                                                setPerRV(
                                                                                                    (
                                                                                                        s: PerRVSelection
                                                                                                    ) => ({
                                                                                                        ...s,
                                                                                                        [rvKey]:
                                                                                                            {},
                                                                                                    })
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <RotateCcw className="h-4 w-4" />
                                                                                        </Button>
                                                                                    </motion.div>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>
                                                                                        Bersihkan
                                                                                        pilihan
                                                                                        di
                                                                                        atas
                                                                                    </p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </motion.div>
                                            </motion.div>
                                        )}
                                </AnimatePresence>
                            </motion.div>
                        </TabsContent>
                    </AnimatePresence>

                    {/* ================= TAB: KATALOG ================= */}
                    <AnimatePresence mode="wait">
                        <TabsContent
                            value="catalog"
                            className="space-y-4 mt-4"
                            asChild
                        >
                            <motion.div key="tab-catalog" {...fadeUp}>
                                <Accordion
                                    type="multiple"
                                    defaultValue={["operators", "vehicles"]}
                                    className="w-full"
                                >
                                    {/* Operators */}
                                    <AccordionItem value="operators">
                                        <AccordionTrigger className="text-lg font-semibold">
                                            <div className="flex items-center gap-3">
                                                <Users className="h-5 w-5" />
                                                Manajemen Operator
                                            </div>
                                        </AccordionTrigger>
                                        {/* ✨ motion: fade content on open */}
                                        <AccordionContent asChild>
                                            <motion.div
                                                {...fadeIn}
                                                className="pt-4 space-y-4"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="relative flex-1 max-w-sm">
                                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Cari nama operator..."
                                                            className="pl-8"
                                                            value={
                                                                operatorSearch
                                                            }
                                                            onChange={(e) =>
                                                                setOperatorSearch(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <motion.div
                                                        whileTap={{
                                                            scale: 0.98,
                                                        }}
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setShowAddOp(
                                                                    !showAddOp
                                                                )
                                                            }
                                                        >
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            {showAddOp
                                                                ? "Tutup Form"
                                                                : "Tambah Operator"}
                                                        </Button>
                                                    </motion.div>
                                                </div>

                                                <AnimatePresence>
                                                    {showAddOp && (
                                                        <motion.div {...fadeUp}>
                                                            <Card>
                                                                <CardHeader>
                                                                    <CardTitle className="text-base">
                                                                        Form
                                                                        Operator
                                                                        Baru
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="space-y-4">
                                                                    <div className="grid sm:grid-cols-2 gap-4">
                                                                        <div className="space-y-1.5">
                                                                            <Label htmlFor="op-name">
                                                                                Nama{" "}
                                                                                <span className="text-destructive">
                                                                                    *
                                                                                </span>
                                                                            </Label>
                                                                            <Input
                                                                                id="op-name"
                                                                                placeholder="Nama Lengkap"
                                                                                value={
                                                                                    newOp.name
                                                                                }
                                                                                onChange={(
                                                                                    e
                                                                                ) =>
                                                                                    setNewOp(
                                                                                        (
                                                                                            s
                                                                                        ) => ({
                                                                                            ...s,
                                                                                            name: e
                                                                                                .target
                                                                                                .value,
                                                                                        })
                                                                                    )
                                                                                }
                                                                            />
                                                                            {newOpError &&
                                                                                !newOp.name.trim() && (
                                                                                    <p className="text-xs text-destructive">
                                                                                        {
                                                                                            newOpError
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <Label htmlFor="op-phone">
                                                                                No.
                                                                                Telepon
                                                                                (Opsional)
                                                                            </Label>
                                                                            <Input
                                                                                id="op-phone"
                                                                                placeholder="0812..."
                                                                                value={
                                                                                    newOp.phone
                                                                                }
                                                                                onChange={(
                                                                                    e
                                                                                ) =>
                                                                                    setNewOp(
                                                                                        (
                                                                                            s
                                                                                        ) => ({
                                                                                            ...s,
                                                                                            phone: e
                                                                                                .target
                                                                                                .value,
                                                                                        })
                                                                                    )
                                                                                }
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id="op-active"
                                                                            checked={
                                                                                newOp.active
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked
                                                                            ) =>
                                                                                setNewOp(
                                                                                    (
                                                                                        s
                                                                                    ) => ({
                                                                                        ...s,
                                                                                        active: !!checked,
                                                                                    })
                                                                                )
                                                                            }
                                                                        />
                                                                        <Label
                                                                            htmlFor="op-active"
                                                                            className="cursor-pointer"
                                                                        >
                                                                            Aktif
                                                                            (Dapat
                                                                            ditugaskan)
                                                                        </Label>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <motion.div
                                                                            whileTap={{
                                                                                scale: 0.98,
                                                                            }}
                                                                        >
                                                                            <Button
                                                                                disabled={
                                                                                    !newOp.name.trim() ||
                                                                                    createOp.isPending
                                                                                }
                                                                                onClick={() => {
                                                                                    setNewOpError(
                                                                                        ""
                                                                                    );
                                                                                    if (
                                                                                        !newOp.name.trim()
                                                                                    ) {
                                                                                        setNewOpError(
                                                                                            "Nama tidak boleh kosong."
                                                                                        );
                                                                                        return;
                                                                                    }
                                                                                    createOp.mutate(
                                                                                        {
                                                                                            name: newOp.name.trim(),
                                                                                            phone:
                                                                                                newOp.phone.trim() ||
                                                                                                undefined,
                                                                                            active: newOp.active,
                                                                                        }
                                                                                    );
                                                                                }}
                                                                            >
                                                                                {createOp.isPending ? (
                                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    "Simpan"
                                                                                )}
                                                                            </Button>
                                                                        </motion.div>
                                                                        <motion.div
                                                                            whileTap={{
                                                                                scale: 0.98,
                                                                            }}
                                                                        >
                                                                            <Button
                                                                                variant="outline"
                                                                                onClick={() => {
                                                                                    setNewOp(
                                                                                        () => ({
                                                                                            name: "",
                                                                                            phone: "",
                                                                                            active: true,
                                                                                        })
                                                                                    );
                                                                                    setShowAddOp(
                                                                                        false
                                                                                    );
                                                                                }}
                                                                            >
                                                                                Batal
                                                                            </Button>
                                                                        </motion.div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <motion.div
                                                    {...fadeIn}
                                                    className="rounded-md border"
                                                >
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>
                                                                    Nama
                                                                </TableHead>
                                                                <TableHead>
                                                                    Telepon
                                                                </TableHead>
                                                                <TableHead>
                                                                    Status
                                                                </TableHead>
                                                                <TableHead className="text-right">
                                                                    Aksi
                                                                </TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {fetchingOperators && (
                                                                <tr>
                                                                    <TableCell
                                                                        colSpan={
                                                                            4
                                                                        }
                                                                        className="text-center"
                                                                    >
                                                                        <Loader2 className="h-4 w-4 mx-auto animate-spin" />
                                                                    </TableCell>
                                                                </tr>
                                                            )}
                                                            {!fetchingOperators &&
                                                                filteredOperators.length ===
                                                                    0 && (
                                                                    <tr>
                                                                        <TableCell
                                                                            colSpan={
                                                                                4
                                                                            }
                                                                            className="text-center text-muted-foreground"
                                                                        >
                                                                            Tidak
                                                                            ada
                                                                            hasil
                                                                            untuk
                                                                            pencarian.
                                                                        </TableCell>
                                                                    </tr>
                                                                )}
                                                            {filteredOperators.map(
                                                                (o) => (
                                                                    <TableRow
                                                                        key={
                                                                            o.id
                                                                        }
                                                                        className="hover:bg-muted/50 transition-colors"
                                                                    >
                                                                        <TableCell className="font-medium">
                                                                            {
                                                                                o.name
                                                                            }
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {o.phone ??
                                                                                "—"}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Badge
                                                                                variant={
                                                                                    o.active
                                                                                        ? "default"
                                                                                        : "secondary"
                                                                                }
                                                                            >
                                                                                {o.active
                                                                                    ? "Aktif"
                                                                                    : "Nonaktif"}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger
                                                                                    asChild
                                                                                >
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                    >
                                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end">
                                                                                    <DropdownMenuItem
                                                                                        onClick={() =>
                                                                                            updateOp.mutate(
                                                                                                {
                                                                                                    id: o.id,
                                                                                                    patch: {
                                                                                                        active: !o.active,
                                                                                                    },
                                                                                                }
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        {o.active ? (
                                                                                            <ToggleLeft className="mr-2 h-4 w-4" />
                                                                                        ) : (
                                                                                            <ToggleRight className="mr-2 h-4 w-4" />
                                                                                        )}
                                                                                        {o.active
                                                                                            ? "Nonaktifkan"
                                                                                            : "Aktifkan"}
                                                                                    </DropdownMenuItem>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem
                                                                                        className="text-destructive"
                                                                                        onClick={() =>
                                                                                            setDeletingOperator(
                                                                                                o
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                                        Hapus
                                                                                    </DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </motion.div>
                                            </motion.div>
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* Vehicles */}
                                    <AccordionItem value="vehicles">
                                        <AccordionTrigger className="text-lg font-semibold">
                                            <div className="flex items-center gap-3">
                                                <Truck className="h-5 w-5" />
                                                Manajemen Kendaraan
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent asChild>
                                            <motion.div
                                                {...fadeIn}
                                                className="pt-4 space-y-4"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm text-muted-foreground">
                                                        Kelola data master
                                                        kendaraan (mobil
                                                        penyiram).
                                                    </p>
                                                    <motion.div
                                                        whileTap={{
                                                            scale: 0.98,
                                                        }}
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setShowAddVeh(
                                                                    !showAddVeh
                                                                )
                                                            }
                                                        >
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            {showAddVeh
                                                                ? "Tutup Form"
                                                                : "Tambah Kendaraan"}
                                                        </Button>
                                                    </motion.div>
                                                </div>

                                                <AnimatePresence>
                                                    {showAddVeh && (
                                                        <motion.div {...fadeUp}>
                                                            <Card>
                                                                <CardHeader>
                                                                    <CardTitle className="text-base">
                                                                        Form
                                                                        Kendaraan
                                                                        Baru
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="space-y-4">
                                                                    <div className="grid sm:grid-cols-2 gap-4">
                                                                        <div className="space-y-1.5">
                                                                            <Label htmlFor="veh-plate">
                                                                                No.
                                                                                Polisi
                                                                                (Nopol)
                                                                                <span className="text-destructive">
                                                                                    *
                                                                                </span>
                                                                            </Label>
                                                                            <Input
                                                                                id="veh-plate"
                                                                                placeholder="L 1234 ABC"
                                                                                value={
                                                                                    newVeh.plate
                                                                                }
                                                                                onChange={(
                                                                                    e
                                                                                ) =>
                                                                                    setNewVeh(
                                                                                        (
                                                                                            s
                                                                                        ) => ({
                                                                                            ...s,
                                                                                            plate: e
                                                                                                .target
                                                                                                .value,
                                                                                        })
                                                                                    )
                                                                                }
                                                                            />
                                                                            {newVehError &&
                                                                                !newVeh.plate.trim() && (
                                                                                    <p className="text-xs text-destructive">
                                                                                        {
                                                                                            newVehError
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <Label htmlFor="veh-cap">
                                                                                Kapasitas
                                                                                (Liter)
                                                                                <span className="text-destructive">
                                                                                    *
                                                                                </span>
                                                                            </Label>
                                                                            <Input
                                                                                id="veh-cap"
                                                                                type="number"
                                                                                placeholder="5000"
                                                                                value={
                                                                                    Number.isFinite(
                                                                                        newVeh.capacityL
                                                                                    )
                                                                                        ? newVeh.capacityL
                                                                                        : ""
                                                                                }
                                                                                onChange={(
                                                                                    e
                                                                                ) =>
                                                                                    setNewVeh(
                                                                                        (
                                                                                            s
                                                                                        ) => ({
                                                                                            ...s,
                                                                                            capacityL:
                                                                                                e
                                                                                                    .target
                                                                                                    .value ===
                                                                                                ""
                                                                                                    ? 0
                                                                                                    : Number(
                                                                                                          e
                                                                                                              .target
                                                                                                              .value
                                                                                                      ),
                                                                                        })
                                                                                    )
                                                                                }
                                                                            />
                                                                            {newVehError &&
                                                                                newVeh.capacityL <=
                                                                                    0 && (
                                                                                    <p className="text-xs text-destructive">
                                                                                        {
                                                                                            newVehError
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id="veh-active"
                                                                            checked={
                                                                                newVeh.active
                                                                            }
                                                                            onCheckedChange={(
                                                                                checked
                                                                            ) =>
                                                                                setNewVeh(
                                                                                    (
                                                                                        s
                                                                                    ) => ({
                                                                                        ...s,
                                                                                        active: !!checked,
                                                                                    })
                                                                                )
                                                                            }
                                                                        />
                                                                        <Label
                                                                            htmlFor="veh-active"
                                                                            className="cursor-pointer"
                                                                        >
                                                                            Aktif
                                                                            (Dapat
                                                                            digunakan)
                                                                        </Label>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <motion.div
                                                                            whileTap={{
                                                                                scale: 0.98,
                                                                            }}
                                                                        >
                                                                            <Button
                                                                                disabled={
                                                                                    !newVeh.plate.trim() ||
                                                                                    newVeh.capacityL <=
                                                                                        0 ||
                                                                                    createVeh.isPending
                                                                                }
                                                                                onClick={() => {
                                                                                    setNewVehError(
                                                                                        ""
                                                                                    );
                                                                                    if (
                                                                                        !newVeh.plate.trim()
                                                                                    ) {
                                                                                        setNewVehError(
                                                                                            "Nopol tidak boleh kosong."
                                                                                        );
                                                                                        return;
                                                                                    }
                                                                                    if (
                                                                                        newVeh.capacityL <=
                                                                                        0
                                                                                    ) {
                                                                                        setNewVehError(
                                                                                            "Kapasitas harus lebih dari 0."
                                                                                        );
                                                                                        return;
                                                                                    }
                                                                                    createVeh.mutate(
                                                                                        {
                                                                                            plate: newVeh.plate.trim(),
                                                                                            capacityL:
                                                                                                Number(
                                                                                                    newVeh.capacityL
                                                                                                ) ||
                                                                                                0,
                                                                                            active: newVeh.active,
                                                                                        }
                                                                                    );
                                                                                }}
                                                                            >
                                                                                {createVeh.isPending ? (
                                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    "Simpan"
                                                                                )}
                                                                            </Button>
                                                                        </motion.div>
                                                                        <motion.div
                                                                            whileTap={{
                                                                                scale: 0.98,
                                                                            }}
                                                                        >
                                                                            <Button
                                                                                variant="outline"
                                                                                onClick={() => {
                                                                                    setNewVeh(
                                                                                        () => ({
                                                                                            plate: "",
                                                                                            capacityL: 0,
                                                                                            active: true,
                                                                                        })
                                                                                    );
                                                                                    setShowAddVeh(
                                                                                        false
                                                                                    );
                                                                                }}
                                                                            >
                                                                                Batal
                                                                            </Button>
                                                                        </motion.div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <motion.div
                                                    {...fadeIn}
                                                    className="rounded-md border"
                                                >
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>
                                                                    No. Polisi
                                                                </TableHead>
                                                                <TableHead>
                                                                    Kapasitas
                                                                </TableHead>
                                                                <TableHead>
                                                                    Status
                                                                </TableHead>
                                                                <TableHead className="text-right">
                                                                    Aksi
                                                                </TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {fetchingVehicles && (
                                                                <tr>
                                                                    <TableCell
                                                                        colSpan={
                                                                            4
                                                                        }
                                                                        className="text-center"
                                                                    >
                                                                        <Loader2 className="h-4 w-4 mx-auto animate-spin" />
                                                                    </TableCell>
                                                                </tr>
                                                            )}
                                                            {!fetchingVehicles &&
                                                                filteredVehicles.length ===
                                                                    0 && (
                                                                    <tr>
                                                                        <TableCell
                                                                            colSpan={
                                                                                4
                                                                            }
                                                                            className="text-center text-muted-foreground"
                                                                        >
                                                                            Tidak
                                                                            ada
                                                                            kendaraan
                                                                            yang
                                                                            cocok.
                                                                        </TableCell>
                                                                    </tr>
                                                                )}
                                                            {(filteredVehicles.length
                                                                ? filteredVehicles
                                                                : vehicles
                                                            ).map((v) => (
                                                                <TableRow
                                                                    key={v.id}
                                                                >
                                                                    <TableCell className="font-medium">
                                                                        {
                                                                            v.plate
                                                                        }
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {
                                                                            v.capacityL
                                                                        }{" "}
                                                                        L
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge
                                                                            variant={
                                                                                v.active
                                                                                    ? "default"
                                                                                    : "secondary"
                                                                            }
                                                                        >
                                                                            {v.active
                                                                                ? "Aktif"
                                                                                : "Nonaktif"}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger
                                                                                asChild
                                                                            >
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                >
                                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                                <DropdownMenuItem
                                                                                    onClick={() =>
                                                                                        updateVeh.mutate(
                                                                                            {
                                                                                                id: v.id,
                                                                                                patch: {
                                                                                                    active: !v.active,
                                                                                                },
                                                                                            }
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    {v.active ? (
                                                                                        <ToggleLeft className="mr-2 h-4 w-4" />
                                                                                    ) : (
                                                                                        <ToggleRight className="mr-2 h-4 w-4" />
                                                                                    )}
                                                                                    {v.active
                                                                                        ? "Nonaktifkan"
                                                                                        : "Aktifkan"}
                                                                                </DropdownMenuItem>
                                                                                <DropdownMenuSeparator />
                                                                                <DropdownMenuItem
                                                                                    className="text-destructive"
                                                                                    onClick={() =>
                                                                                        setDeletingVehicle(
                                                                                            v
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                                    Hapus
                                                                                </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </motion.div>
                                            </motion.div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </motion.div>
                        </TabsContent>
                    </AnimatePresence>
                </Tabs>

                {/* ====== DIALOG HAPUS OPERATOR ====== */}
                <AlertDialog
                    open={!!deletingOperator}
                    onOpenChange={(open) => !open && setDeletingOperator(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Anda yakin ingin menghapus operator ini?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Operator{" "}
                                <span className="font-bold">
                                    "{deletingOperator?.name}"
                                </span>{" "}
                                akan dihapus secara permanen.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (deletingOperator)
                                        deleteOp.mutate(deletingOperator.id);
                                }}
                                disabled={deleteOp.isPending}
                                asChild
                            >
                                <AlertDialogAction>
                                    {deleteOp.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Ya, Hapus
                                </AlertDialogAction>
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* ====== DIALOG HAPUS KENDARAAN ====== */}
                <AlertDialog
                    open={!!deletingVehicle}
                    onOpenChange={(open) => !open && setDeletingVehicle(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Anda yakin ingin menghapus kendaraan ini?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Kendaraan{" "}
                                <span className="font-bold">
                                    "{deletingVehicle?.plate}"
                                </span>{" "}
                                akan dihapus secara permanen.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (deletingVehicle)
                                        deleteVeh.mutate(deletingVehicle.id);
                                }}
                                disabled={deleteVeh.isPending}
                                asChild
                            >
                                <AlertDialogAction>
                                    {deleteVeh.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Ya, Hapus
                                </AlertDialogAction>
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </motion.section>
        </TooltipProvider>
    );
}
