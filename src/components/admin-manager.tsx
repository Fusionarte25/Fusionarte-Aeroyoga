"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Lock, LogIn } from 'lucide-react';
import { fetchAdminData, getStudentCsv, getClassCsv } from '@/app/actions';
import type { Booking } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

type ClassWithAttendees = {
    classDetails: {
        id: string;
        name: string;
        date: string | Date;
        time: string;
        totalSpots: number;
        bookedSpots: number;
    };
    attendees: {
        name: string;
        email: string;
        phone: string;
    }[];
}

function AdminDashboard() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [classesWithAttendees, setClassesWithAttendees] = useState<ClassWithAttendees[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('students');

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const data = await fetchAdminData();
        const deserializedBookings = data.bookings.map((b: Booking) => ({
            ...b,
            bookingDate: new Date(b.bookingDate),
            classes: b.classes.map(c => ({...c, date: new Date(c.date)}))
        }));
        const deserializedClasses = data.classesWithAttendees.map((c: ClassWithAttendees) => ({
            ...c,
            classDetails: {
                ...c.classDetails,
                date: new Date(c.classDetails.date)
            }
        }));
        setBookings(deserializedBookings);
        setClassesWithAttendees(deserializedClasses);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleExport = async () => {
        const type = activeTab;
        const csvString = type === 'students' ? await getStudentCsv() : await getClassCsv();
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${type}_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    return (
        <Tabs defaultValue="students" className="w-full" onValueChange={setActiveTab}>
            <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                <TabsList>
                    <TabsTrigger value="students">Reservas por Alumna</TabsTrigger>
                    <TabsTrigger value="classes">Asistencia por Clase</TabsTrigger>
                </TabsList>
                <Button onClick={handleExport} variant="outline">
                    <Download className="mr-2 h-4 w-4" /> Exportar Vista Actual
                </Button>
            </div>
            <TabsContent value="students">
                <Card>
                    <CardHeader>
                        <CardTitle>Listado de Alumnas y sus Reservas</CardTitle>
                        <CardDescription>Aquí puedes ver todas las reservas realizadas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="hidden md:table-cell">Email</TableHead>
                                    <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                                    <TableHead>Clases Reservadas</TableHead>
                                    <TableHead className="hidden lg:table-cell">Fecha Reserva</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bookings.length > 0 ? bookings.map(booking => (
                                    <TableRow key={booking.id}>
                                        <TableCell className="font-medium">{booking.student.name}</TableCell>
                                        <TableCell className="hidden md:table-cell">{booking.student.email}</TableCell>
                                        <TableCell className="hidden md:table-cell">{booking.student.phone}</TableCell>
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
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">No hay reservas todavía.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="classes">
                <Card>
                    <CardHeader>
                        <CardTitle>Listado de Asistencia por Clase</CardTitle>
                        <CardDescription>Aquí puedes ver quién está inscrito en cada clase.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {classesWithAttendees.length > 0 ? classesWithAttendees.map(({ classDetails, attendees }) => (
                            <Card key={classDetails.id}>
                                <CardHeader>
                                    <CardTitle>{classDetails.name} - {new Date(classDetails.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las {classDetails.time}</CardTitle>
                                    <CardDescription>Plazas: {classDetails.bookedSpots} / {classDetails.totalSpots}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {attendees.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nombre</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Teléfono</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {attendees.map((attendee, index) => (
                                                    <TableRow key={`${classDetails.id}-${attendee.email}-${index}`}>
                                                        <TableCell>{attendee.name}</TableCell>
                                                        <TableCell>{attendee.email}</TableCell>
                                                        <TableCell>{attendee.phone}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">No hay alumnas inscritas en esta clase.</p>
                                    )}
                                </CardContent>
                            </Card>
                        )) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No hay clases programadas.</p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
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
