"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Lock, LogIn, PlusCircle, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { addClass, deleteClass, fetchAdminData, getActiveBookingMonth, getClassCsv, getStudentCsv, setActiveBookingMonth, updateClass, updateBookingClasses } from '@/app/actions';
import type { AeroClass, Booking } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClassWithAttendees = {
    classDetails: AeroClass;
    attendees: { name: string; email: string; phone: string; }[];
}

function ClassForm({ classData, onSave, onCancel }: {
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
    onSave: (bookingId: string, newClassIds: {id: string}[]) => void;
    onCancel: () => void;
}) {
    const [selectedClassIds, setSelectedClassIds] = useState(booking.classes.map(c => c.id));
    
    const handleClassChange = (index: number, newClassId: string) => {
        const newSelection = [...selectedClassIds];
        newSelection[index] = newClassId;
        setSelectedClassIds(newSelection);
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(booking.id, selectedClassIds.map(id => ({id})));
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const availableClasses = allClasses
        .filter(c => new Date(c.date) >= today)
        .filter(c => (c.totalSpots - c.bookedSpots > 0) || selectedClassIds.includes(c.id));

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <DialogDescription>
                Editando la reserva de <span className="font-bold text-primary">{booking.student.name}</span> para el bono de {booking.packSize} clases.
            </DialogDescription>
            <div className="space-y-3 max-h-[400px] overflow-y-auto p-1">
                {Array.from({ length: booking.packSize }).map((_, index) => {
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
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
        </form>
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
    const [editingClass, setEditingClass] = useState<AeroClass | null>(null);
    const [classToDelete, setClassToDelete] = useState<AeroClass | null>(null);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [activeMonth, setActiveMonth] = useState<Date | null>(null);

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
            setActiveMonth(new Date(month));
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

    const handleMonthChange = async (offset: number) => {
        if (!activeMonth) return;
        const newMonthDate = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + offset, 1);
        const newActiveMonth = await setActiveBookingMonth(newMonthDate.getFullYear(), newMonthDate.getMonth());
        setActiveMonth(new Date(newActiveMonth));
        toast({ title: "Mes actualizado", description: `Ahora las alumnas reservarán para ${new Date(newActiveMonth).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}.` });
    };

    const handleOpenAddModal = () => {
        setEditingClass(null);
        setIsClassModalOpen(true);
    };

    const handleOpenEditModal = (cls: AeroClass) => {
        setEditingClass(cls);
        setIsClassModalOpen(true);
    };
    
    const handleSaveClass = async (classFormData: any) => {
        const result = editingClass
            ? await updateClass({ ...classFormData, id: editingClass.id, bookedSpots: editingClass.bookedSpots })
            : await addClass(classFormData);

        if (result.success) {
            toast({ title: "¡Éxito!", description: `Clase ${editingClass ? 'actualizada' : 'creada'} correctamente.` });
            setIsClassModalOpen(false);
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
    
    const handleSaveBookingChanges = async (bookingId: string, newClassIds: {id: string}[]) => {
        const result = await updateBookingClasses(bookingId, newClassIds);
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
                <CardContent>
                    <div className="flex items-center gap-4">
                        <h3 className="text-sm font-semibold">Mes de Reservas Activo:</h3>
                        {activeMonth && (
                            <div className="flex items-center gap-2">
                                <Button size="icon" variant="outline" onClick={() => handleMonthChange(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                                <span className="font-bold text-lg text-primary w-48 text-center">{activeMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</span>
                                <Button size="icon" variant="outline" onClick={() => handleMonthChange(1)}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="students" className="w-full" onValueChange={setActiveTab}>
                <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="students">Reservas por Alumna</TabsTrigger>
                        <TabsTrigger value="classes">Asistencia por Clase</TabsTrigger>
                        <TabsTrigger value="manage-classes">Gestionar Clases</TabsTrigger>
                    </TabsList>
                    {(activeTab === 'students' || activeTab === 'classes') && (
                        <Button onClick={handleExport} variant="outline">
                            <Download className="mr-2 h-4 w-4" /> Exportar Vista
                        </Button>
                    )}
                </div>
                <TabsContent value="students">
                    <Card>
                        <CardHeader>
                            <CardTitle>Listado de Alumnas y sus Reservas</CardTitle>
                            <CardDescription>Aquí puedes ver y editar todas las reservas realizadas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Bono</TableHead>
                                        <TableHead>Precio</TableHead>
                                        <TableHead>Clases Reservadas</TableHead>
                                        <TableHead className="hidden lg:table-cell">Fecha Reserva</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bookings.length > 0 ? bookings.map(booking => (
                                        <TableRow key={booking.id}>
                                            <TableCell className="font-medium">{booking.student.name}</TableCell>
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
                                            <TableCell className="hidden lg:table-cell">{new Date(booking.bookingDate).toLocaleString('es-ES')}</TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="icon" onClick={() => setEditingBooking(booking)}><Edit className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24">No hay reservas todavía.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="classes">
                    <Card>
                        <CardHeader><CardTitle>Listado de Asistencia por Clase</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {classesWithAttendees.length > 0 ? classesWithAttendees.filter(cwa => new Date(cwa.classDetails.date) > new Date(Date.now() - 86400000)).map(({ classDetails, attendees }) => (
                                <Card key={classDetails.id}>
                                    <CardHeader>
                                        <CardTitle>{classDetails.name} - {new Date(classDetails.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las {classDetails.time}</CardTitle>
                                        <CardDescription>
                                            Plazas: {classDetails.bookedSpots} / {classDetails.totalSpots}
                                            {classDetails.teacher && ` - Profesora: ${classDetails.teacher}`}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {attendees.length > 0 ? (<Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Teléfono</TableHead></TableRow></TableHeader><TableBody>{attendees.map((attendee, index) => (<TableRow key={`${classDetails.id}-${attendee.email}-${index}`}><TableCell>{attendee.name}</TableCell><TableCell>{attendee.email}</TableCell><TableCell>{attendee.phone}</TableCell></TableRow>))}</TableBody></Table>) : (<p className="text-sm text-muted-foreground text-center py-4">No hay alumnas inscritas.</p>)}
                                    </CardContent>
                                </Card>
                            )) : (<p className="text-sm text-muted-foreground text-center py-4">No hay clases programadas.</p>)}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="manage-classes">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div className="space-y-1">
                                <CardTitle>Gestionar Clases</CardTitle>
                                <CardDescription>Añade, edita o elimina clases del calendario.</CardDescription>
                            </div>
                            <Button onClick={handleOpenAddModal}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Clase</Button>
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
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
            </Tabs>
            
            <Dialog open={isClassModalOpen} onOpenChange={setIsClassModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingClass ? 'Editar' : 'Añadir Nueva'} Clase</DialogTitle>
                        <DialogDescription>Completa los detalles de la clase.</DialogDescription>
                    </DialogHeader>
                    <ClassForm classData={editingClass} onSave={handleSaveClass} onCancel={() => setIsClassModalOpen(false)} />
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
                <DialogContent>
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
