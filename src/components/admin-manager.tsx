"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Lock, LogIn, PlusCircle, Edit, Trash2, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { addClass, addRecurringClasses, deleteClass, fetchAdminData, getActiveBookingMonth, getClassCsv, getStudentCsv, setActiveBookingMonth, updateClass, updateFullBooking, getTeacherStats } from '@/app/actions';
import type { AeroClass, Booking } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

type ClassWithAttendees = {
    classDetails: AeroClass;
    attendees: { name: string; email: string; phone: string; }[];
}

const weekdayOptions = [
    { label: 'Domingo', value: 0 },
    { label: 'Lunes', value: 1 },
    { label: 'Martes', value: 2 },
    { label: 'Miércoles', value: 3 },
    { label: 'Jueves', value: 4 },
    { label: 'Viernes', value: 5 },
    { label: 'Sábado', value: 6 },
];

const monthOptions = [
    { label: 'Enero', value: 0 }, { label: 'Febrero', value: 1 }, { label: 'Marzo', value: 2 },
    { label: 'Abril', value: 3 }, { label: 'Mayo', value: 4 }, { label: 'Junio', value: 5 },
    { label: 'Julio', value: 6 }, { label: 'Agosto', value: 7 }, { label: 'Septiembre', value: 8 },
    { label: 'Octubre', value: 9 }, { label: 'Noviembre', value: 10 }, { label: 'Diciembre', value: 11 },
];

function ClassCreationForm({ onSave, onCancel }: {
    onSave: (type: 'single' | 'recurring', data: any) => void;
    onCancel: () => void;
}) {
    const [type, setType] = useState<'single' | 'recurring'>('single');
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name: 'Aeroyoga',
        date: '',
        time: '',
        totalSpots: 7,
        teacher: 'Alexandra',
        day: 2, // Martes
        months: [] as number[],
        year: new Date().getFullYear(),
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) }));
    };

    const handleMonthChange = (monthValue: number) => {
        setFormData(prev => {
            const newMonths = prev.months.includes(monthValue)
                ? prev.months.filter(m => m !== monthValue)
                : [...prev.months, monthValue];
            return { ...prev, months: newMonths };
        });
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { year, months, day, ...rest } = formData;
        if (type === 'single') {
            onSave('single', { ...rest, date: formData.date });
        } else {
            if (months.length === 0) {
                 toast({ variant: "destructive", title: "Error", description: "Debes seleccionar al menos un mes." });
                 return;
            }
            onSave('recurring', { ...rest, day, months, year });
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <RadioGroup onValueChange={(v) => setType(v as 'single' | 'recurring')} value={type} className="flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="single" id="r-single" /><Label htmlFor="r-single">Clase Única</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="recurring" id="r-recurring" /><Label htmlFor="r-recurring">Clase Regular</Label></div>
            </RadioGroup>
            
            <Separator />

            <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Clase</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="totalSpots">Plazas Totales</Label>
                    <Input id="totalSpots" name="totalSpots" type="number" value={formData.totalSpots} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="teacher">Profesor/a</Label>
                    <Input id="teacher" name="teacher" value={formData.teacher} onChange={handleChange} />
                </div>
            </div>

            {type === 'single' ? (
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="date">Fecha</Label>
                        <Input id="date" name="date" type="date" value={formData.date} onChange={handleChange} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="time">Hora</Label>
                        <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} required />
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Día de la Semana</Label>
                            <Select onValueChange={(v) => handleSelectChange('day', v)} defaultValue={formData.day.toString()}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {weekdayOptions.map(opt => <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="time">Hora</Label>
                            <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Meses de Aplicación ({formData.year})</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {monthOptions.map(month => (
                                <div key={month.value} className="flex items-center space-x-2">
                                    <Checkbox id={`m-${month.value}`} checked={formData.months.includes(month.value)} onCheckedChange={() => handleMonthChange(month.value)} />
                                    <Label htmlFor={`m-${month.value}`} className="font-normal">{month.label}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit">Guardar Clase(s)</Button>
            </DialogFooter>
        </form>
    );
}

function EditClassForm({ classData, onSave, onCancel }: {
    classData: Partial<AeroClass> | null;
    onSave: (data: any) => void;
    onCancel: () => void;
}) {
    const [formData, setFormData] = useState({
        name: classData?.name || 'Aeroyoga',
        date: classData?.date ? new Date(classData.date).toISOString().split('T')[0] : '',
        time: classData?.time || '',
        totalSpots: classData?.totalSpots || 7,
        teacher: classData?.teacher || 'Alexandra',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Clase</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="date">Fecha</Label>
                    <Input id="date" name="date" type="date" value={formData.date} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="time">Hora</Label>
                    <Input id="time" name="time" type="time" value={formData.time} onChange={handleChange} required />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="totalSpots">Plazas Totales</Label>
                    <Input id="totalSpots" name="totalSpots" type="number" value={formData.totalSpots} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="teacher">Profesor/a</Label>
                    <Input id="teacher" name="teacher" value={formData.teacher} onChange={handleChange} />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit">Guardar Clase</Button>
            </DialogFooter>
        </form>
    )
}

function EditBookingForm({ booking, allClasses, onSave, onCancel }: {
    booking: Booking;
    allClasses: AeroClass[];
    onSave: (bookingId: string, updates: any) => void;
    onCancel: () => void;
}) {
    const [student, setStudent] = useState(booking.student);
    const [price, setPrice] = useState(booking.price);
    const [packSize, setPackSize] = useState(booking.packSize);
    const [selectedClassIds, setSelectedClassIds] = useState(booking.classes.map(c => c.id));
    
    const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStudent(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }

    const handleClassChange = (index: number, newClassId: string) => {
        const newSelection = [...selectedClassIds];
        // Ensure the index exists before assigning
        if (index < packSize) {
            newSelection[index] = newClassId;
            setSelectedClassIds(newSelection);
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(booking.id, { student, price, packSize, classIds: selectedClassIds.slice(0, packSize).map(id => ({id})) });
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const availableClasses = allClasses
        .filter(c => new Date(c.date) >= today)
        .filter(c => (c.totalSpots - c.bookedSpots > 0) || selectedClassIds.includes(c.id));

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <DialogDescription>
                Editando la reserva de <span className="font-bold text-primary">{booking.student.name}</span>.
            </DialogDescription>
            
            <div className="space-y-4 border p-4 rounded-md">
                <h4 className="font-semibold text-lg">Detalles de la Alumna</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input id="name" name="name" value={student.name} onChange={handleStudentChange} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" value={student.email} onChange={handleStudentChange} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" name="phone" value={student.phone} onChange={handleStudentChange} />
                </div>
                <Separator />
                <h4 className="font-semibold text-lg">Detalles del Bono</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="packSize">Nº de Clases (Bono)</Label>
                        <Input id="packSize" name="packSize" type="number" value={packSize} onChange={(e) => setPackSize(parseInt(e.target.value, 10))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="price">Precio (€)</Label>
                        <Input id="price" name="price" type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value))} />
                    </div>
                </div>
            </div>

            <div className="space-y-4 border p-4 rounded-md">
                <h4 className="font-semibold text-lg">Clases Seleccionadas</h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto p-1">
                    {Array.from({ length: packSize }).map((_, index) => {
                        const classId = selectedClassIds[index];
                        return (
                            <div key={index} className="space-y-2">
                                <Label>Clase {index + 1}</Label>
                                <Select onValueChange={(newId) => handleClassChange(index, newId)} defaultValue={classId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona una clase" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableClasses.map(cls => (
                                            <SelectItem key={cls.id} value={cls.id} disabled={selectedClassIds.includes(cls.id) && cls.id !== classId}>
                                                {cls.name} - {new Date(cls.date).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})} {cls.time} ({cls.totalSpots - cls.bookedSpots} libres)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
        </form>
    )
}

function StatisticsTab() {
    const [date, setDate] = useState(new Date());
    const [stats, setStats] = useState<Record<string, number> | null>(null);
    const { toast } = useToast();

    const fetchStats = useCallback(async (year: number, month: number) => {
        setStats(null); // Show loading state
        const result = await getTeacherStats(year, month);
        if (result.success) {
            setStats(result.stats);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las estadísticas.' });
            setStats({});
        }
    }, [toast]);
    
    useEffect(() => {
        fetchStats(date.getFullYear(), date.getMonth());
    }, [date, fetchStats]);

    const handleMonthChange = (offset: number) => {
        setDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Estadísticas por Profesor</CardTitle>
                <CardDescription>Consulta cuántas clases ha impartido cada profesor en el mes seleccionado.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-sm font-semibold">Seleccionar Mes:</h3>
                    <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" onClick={() => handleMonthChange(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="font-bold text-lg text-primary w-48 text-center">{date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</span>
                        <Button size="icon" variant="outline" onClick={() => handleMonthChange(1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>

                {!stats ? <Skeleton className="h-24 w-full" /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Profesor/a</TableHead>
                                <TableHead className="text-right">Nº de Clases</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.keys(stats).length > 0 ? Object.entries(stats).map(([teacher, count]) => (
                                <TableRow key={teacher}>
                                    <TableCell className="font-medium">{teacher}</TableCell>
                                    <TableCell className="text-right font-bold text-lg">{count}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center h-24">No hay datos para este mes.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

function MonthNavigator({ date, onDateChange }: { date: Date, onDateChange: (newDate: Date) => void }) {
    const handleMonthChange = (offset: number) => {
        onDateChange(new Date(date.getFullYear(), date.getMonth() + offset, 1));
    };

    return (
        <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => handleMonthChange(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-bold text-lg text-primary w-48 text-center">
                {date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </span>
            <Button size="icon" variant="outline" onClick={() => handleMonthChange(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
    )
}

function AdminDashboard() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [classesWithAttendees, setClassesWithAttendees] = useState<ClassWithAttendees[]>([]);
    const [allClasses, setAllClasses] = useState<AeroClass[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('students');
    const { toast } = useToast();
    
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<AeroClass | null>(null);
    const [classToDelete, setClassToDelete] = useState<AeroClass | null>(null);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [activeMonth, setActiveMonth] = useState<Date | null>(null);
    const [displayDate, setDisplayDate] = useState(new Date());

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [data, month] = await Promise.all([fetchAdminData(), getActiveBookingMonth()]);
            
            const deserializedBookings = data.bookings.map((b: any) => ({
                ...b,
                bookingDate: new Date(b.bookingDate),
                classes: b.classes.map((c: any) => ({...c, date: new Date(c.date)}))
            }));
            const deserializedClasses = data.classesWithAttendees.map((c: any) => ({
                ...c,
                classDetails: {
                    ...c.classDetails,
                    date: new Date(c.classDetails.date)
                }
            }));
            const deserializedAllClasses = data.allClasses.map((c: any) => ({
                ...c,
                date: new Date(c.date)
            }));

            setBookings(deserializedBookings);
            setClassesWithAttendees(deserializedClasses);
            setAllClasses(deserializedAllClasses);
            setActiveMonth(month ? new Date(month) : null);
        } catch (error) {
            console.error("Failed to load admin data", error);
            toast({
                variant: "destructive",
                title: "Error al cargar datos",
                description: "No se pudieron cargar los datos del panel de administrador."
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleActiveMonthChange = async (offset: number | null) => {
        let newDate: Date;
        if (offset === null) {
            const newActiveMonth = await setActiveBookingMonth(null, null);
            setActiveMonth(null);
            toast({ title: "Mes de reserva desactivado", description: "Las alumnas ya no podrán realizar nuevas reservas." });
            return;
        }

        if (!activeMonth) {
            newDate = new Date();
        } else {
             newDate = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + offset, 1);
        }

        const newActiveMonth = await setActiveBookingMonth(newDate.getFullYear(), newDate.getMonth());
        setActiveMonth(newActiveMonth ? new Date(newActiveMonth) : null);
        toast({ title: "Mes actualizado", description: `Ahora las alumnas reservarán para ${new Date(newActiveMonth!).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}.` });
    };

    const handleOpenAddModal = () => {
        setIsCreationModalOpen(true);
    };

    const handleOpenEditModal = (cls: AeroClass) => {
        setEditingClass(cls);
        setIsClassModalOpen(true);
    };
    
    const handleSaveClass = async (classFormData: any) => {
        const result = await updateClass({ ...classFormData, id: editingClass!.id, bookedSpots: editingClass!.bookedSpots });
        if (result.success) {
            toast({ title: "¡Éxito!", description: `Clase actualizada correctamente.` });
            setIsClassModalOpen(false);
            setEditingClass(null);
            loadData();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

     const handleCreateClasses = async (type: 'single' | 'recurring', data: any) => {
        const result = type === 'single'
            ? await addClass(data)
            : await addRecurringClasses(data);

        if (result.success) {
            const count = result.classes?.length || 1;
            toast({ title: "¡Éxito!", description: `${count} clase(s) creada(s) correctamente.` });
            setIsCreationModalOpen(false);
            loadData();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };
    
    const handleDeleteClass = async () => {
        if (!classToDelete) return;

        const result = await deleteClass(classToDelete.id);
        if (result.success) {
            toast({ title: "Clase Eliminada", description: "La clase se ha eliminado correctamente." });
            setClassToDelete(null);
            loadData();
        } else {
            toast({ variant: "destructive", title: "Error al eliminar", description: result.error });
            setClassToDelete(null);
        }
    };
    
    const handleSaveBookingChanges = async (bookingId: string, updates: any) => {
        const result = await updateFullBooking(bookingId, updates);
        if (result.success) {
            toast({ title: "¡Éxito!", description: "La reserva se ha actualizado correctamente." });
            setEditingBooking(null);
            loadData();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    const handleExport = async () => {
        if (activeTab !== 'students' && activeTab !== 'classes') return;
        const csvString = activeTab === 'students' ? await getStudentCsv() : await getClassCsv();
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${activeTab}_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredBookings = bookings.filter(b => {
        if (!b.classes || b.classes.length === 0) return false;
        const firstClassDate = new Date(b.classes[0].date);
        return firstClassDate.getFullYear() === displayDate.getFullYear() && firstClassDate.getMonth() === displayDate.getMonth();
    });

    const filteredClasses = classesWithAttendees.filter(cwa => {
        const classDate = new Date(cwa.classDetails.date);
        return classDate.getFullYear() === displayDate.getFullYear() && classDate.getMonth() === displayDate.getMonth();
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full max-w-md" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    return (
        <>
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Gestión de Inscripciones</CardTitle>
                    <CardDescription>Selecciona el mes en el que las alumnas pueden realizar sus reservas.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                    <h3 className="text-sm font-semibold">Mes de Reservas Activo:</h3>
                    {activeMonth ? (
                        <div className="flex items-center gap-2">
                            <Button size="icon" variant="outline" onClick={() => handleActiveMonthChange(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <span className="font-bold text-lg text-primary w-48 text-center">{activeMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</span>
                            <Button size="icon" variant="outline" onClick={() => handleActiveMonthChange(1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    ) : (
                        <span className="font-bold text-lg text-destructive w-48 text-center">Inscripciones Cerradas</span>
                    )}
                     <Button variant={activeMonth ? "destructive" : "default"} onClick={() => handleActiveMonthChange(activeMonth ? null : 0)}>
                        {activeMonth ? "Desactivar Inscripciones" : "Activar Mes Actual"}
                    </Button>
                </CardContent>
            </Card>

            <Tabs defaultValue="students" className="w-full" onValueChange={setActiveTab}>
                <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="students">Reservas</TabsTrigger>
                        <TabsTrigger value="classes">Asistencia</TabsTrigger>
                        <TabsTrigger value="manage-classes">Gestionar Clases</TabsTrigger>
                        <TabsTrigger value="stats">Estadísticas</TabsTrigger>
                    </TabsList>
                    {(activeTab === 'students' || activeTab === 'classes') && (
                        <div className="flex items-center gap-4">
                            <MonthNavigator date={displayDate} onDateChange={setDisplayDate} />
                            <Button onClick={handleExport} variant="outline">
                                <Download className="mr-2 h-4 w-4" /> Exportar Vista
                            </Button>
                        </div>
                    )}
                </div>
                <TabsContent value="students">
                    <Card>
                        <CardHeader>
                            <CardTitle>Listado de Alumnas y sus Reservas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Alumna</TableHead>
                                        <TableHead>Fecha Reserva</TableHead>
                                        <TableHead>Bono</TableHead>
                                        <TableHead>Precio</TableHead>
                                        <TableHead>Clases</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredBookings.length > 0 ? filteredBookings.map(booking => (
                                        <TableRow key={booking.id}>
                                            <TableCell className="font-medium">
                                                <div className="font-bold">{booking.student.name}</div>
                                                <div className="text-sm text-muted-foreground">{booking.student.email}</div>
                                                <div className="text-sm text-muted-foreground">{booking.student.phone}</div>
                                            </TableCell>
                                            <TableCell>{new Date(booking.bookingDate).toLocaleString('es-ES')}</TableCell>
                                            <TableCell>{booking.packSize} clases</TableCell>
                                            <TableCell>{booking.price}€</TableCell>
                                            <TableCell>
                                                <ul className="list-disc list-inside text-sm">
                                                    {booking.classes.map(cls => (
                                                        <li key={cls.id}>
                                                            {cls.name} - {new Date(cls.date).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})} {cls.time}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="icon" onClick={() => setEditingBooking(booking)}><Edit className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24">No hay reservas para el mes seleccionado.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="classes">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredClasses.length > 0 ? filteredClasses.map(({ classDetails, attendees }) => (
                            <Card key={classDetails.id}>
                                <CardHeader>
                                    <CardTitle>{classDetails.name}</CardTitle>
                                    <CardDescription>
                                        {new Date(classDetails.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las {classDetails.time}
                                        <br/>
                                        <span className="font-semibold">Profesora: {classDetails.teacher}</span> | Plazas: {classDetails.bookedSpots} / {classDetails.totalSpots}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <h4 className="font-semibold mb-2">Asistentes:</h4>
                                    {attendees.length > 0 ? (
                                        <ul className="list-disc list-inside text-sm">
                                            {attendees.map((attendee, index) => (
                                                <li key={`${classDetails.id}-${attendee.email}-${index}`}>{attendee.name}</li>
                                            ))}
                                        </ul>
                                    ) : (<p className="text-sm text-muted-foreground">No hay alumnas inscritas.</p>)}
                                </CardContent>
                            </Card>
                        )) : (<p className="text-sm text-muted-foreground text-center py-4">No hay clases programadas para el mes seleccionado.</p>)}
                    </div>
                </TabsContent>
                <TabsContent value="manage-classes">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div className="space-y-1">
                                <CardTitle>Gestionar Clases</CardTitle>
                                <CardDescription>Añade, edita o elimina clases del calendario.</CardDescription>
                            </div>
                            <Button onClick={handleOpenAddModal}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase(s)</Button>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Clase</TableHead><TableHead>Fecha y Hora</TableHead><TableHead>Profesora</TableHead><TableHead>Plazas</TableHead><TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allClasses
                                        .filter(c => new Date(c.date) >= new Date(Date.now() - 86400000))
                                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                        .map((classDetails) => (
                                        <TableRow key={classDetails.id}>
                                            <TableCell className="font-medium">{classDetails.name}</TableCell>
                                            <TableCell>{new Date(classDetails.date).toLocaleDateString('es-ES')} - {classDetails.time}</TableCell>
                                            <TableCell>{classDetails.teacher || 'N/A'}</TableCell>
                                            <TableCell>{classDetails.bookedSpots} / {classDetails.totalSpots}</TableCell>
                                            <TableCell className="space-x-2">
                                                <Button variant="outline" size="icon" onClick={() => handleOpenEditModal(classDetails)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="destructive" size="icon" onClick={() => setClassToDelete(classDetails)}><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="stats">
                    <StatisticsTab />
                </TabsContent>
            </Tabs>
            
            <Dialog open={isClassModalOpen} onOpenChange={setIsClassModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar Clase</DialogTitle>
                    </DialogHeader>
                    {editingClass && <EditClassForm classData={editingClass} onSave={handleSaveClass} onCancel={() => setIsClassModalOpen(false)} />}
                </DialogContent>
            </Dialog>

            <Dialog open={isCreationModalOpen} onOpenChange={setIsCreationModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Crear Nuevas Clases</DialogTitle>
                        <DialogDescription>Elige si quieres añadir una clase única o una clase regular para varios meses.</DialogDescription>
                    </DialogHeader>
                    <ClassCreationForm onSave={handleCreateClasses} onCancel={() => setIsCreationModalOpen(false)} />
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!classToDelete} onOpenChange={(open) => !open && setClassToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará la clase "{classToDelete?.name}" del {classToDelete ? new Date(classToDelete.date).toLocaleDateString('es-ES') : ''}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setClassToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteClass}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar Reserva</DialogTitle>
                    </DialogHeader>
                    {editingBooking && (
                        <EditBookingForm 
                            booking={editingBooking}
                            allClasses={allClasses}
                            onSave={handleSaveBookingChanges}
                            onCancel={() => setEditingBooking(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

export function AdminManager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Contraseña incorrecta.');
    }
  };

  if (!isAuthenticated) {
    return (
        <div className="flex justify-center items-center h-[60vh]">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock /> Acceso de Administrador</CardTitle>
                    <CardDescription>Introduce la contraseña para gestionar las reservas.</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input 
                                id="password" 
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                        <Button type="submit" className="w-full">
                            <LogIn className="mr-2 h-4 w-4" /> Entrar
                        </Button>
                    </CardContent>
                </form>
            </Card>
        </div>
    )
  }

  return <AdminDashboard />;
}
