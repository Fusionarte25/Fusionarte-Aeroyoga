'use server'

import {
    getClasses as dbGetClasses,
    getActiveBookingMonth as dbGetActiveBookingMonth,
    setActiveBookingMonth as dbSetActiveBookingMonth,
    addBooking as dbAddBooking,
    updateFullBooking as dbUpdateFullBooking,
    updateBookingStatus as dbUpdateBookingStatus,
    getBookings as dbGetBookings,
    getClassesWithAttendees as dbGetClassesWithAttendees,
    addClass as dbAddClass,
    addRecurringClasses as dbAddRecurringClasses,
    updateClass as dbUpdateClass,
    deleteClass as dbDeleteClass,
    getTeacherStats as dbGetTeacherStats,
    getClassPacks as dbGetClassPacks,
    addClassPack as dbAddClassPack,
    updateClassPack as dbUpdateClassPack,
    deleteClassPack as dbDeleteClassPack
} from '@/lib/data'
import type { AeroClass, Student, Booking, ClassPack } from '@/lib/types'

export async function fetchClasses() {
  const allClasses = dbGetClasses();
  return allClasses;
}

export async function getActiveBookingMonth() {
    const activeMonth = dbGetActiveBookingMonth();
    return activeMonth?.toISOString() ?? null;
}

export async function setActiveBookingMonth(year: number | null, month: number | null) {
    const newActiveMonth = dbSetActiveBookingMonth(year, month);
    return newActiveMonth?.toISOString() ?? null;
}

export async function createBooking(student: Student, selectedClasses: Pick<AeroClass, 'id'>[], packSize: number) {
  try {
    const booking = dbAddBooking(student, selectedClasses, packSize);
    return { success: true, booking: JSON.parse(JSON.stringify(booking)) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFullBooking(bookingId: string, updates: { student: Student, packSize: number, price: number, classIds: {id: string}[], paymentStatus: 'pending' | 'completed' }) {
    try {
        const updatedBooking = dbUpdateFullBooking(bookingId, updates);
        return { success: true, booking: JSON.parse(JSON.stringify(updatedBooking)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function updateBookingStatus(bookingId: string, status: 'pending' | 'completed') {
    try {
        const updatedBooking = dbUpdateBookingStatus(bookingId, status);
        return { success: true, booking: JSON.parse(JSON.stringify(updatedBooking)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}


export async function fetchAdminData() {
    const bookings = dbGetBookings();
    const classesWithAttendees = dbGetClassesWithAttendees();
    const allClasses = dbGetClasses();
    return { 
        bookings: JSON.parse(JSON.stringify(bookings)), 
        classesWithAttendees: JSON.parse(JSON.stringify(classesWithAttendees)),
        allClasses: JSON.parse(JSON.stringify(allClasses)),
    };
}

export async function addClass(classData: Omit<AeroClass, 'id' | 'bookedSpots' | 'date'> & { date: string }) {
    try {
        const newClass = dbAddClass(classData);
        return { success: true, class: JSON.parse(JSON.stringify(newClass)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function addRecurringClasses(data: any) {
    try {
        const newClasses = dbAddRecurringClasses(data);
        return { success: true, classes: JSON.parse(JSON.stringify(newClasses)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function updateClass(classData: Omit<AeroClass, 'date'> & { date: string }) {
    try {
        const updatedClass = dbUpdateClass(classData);
        if (!updatedClass) throw new Error("Class not found");
        return { success: true, class: JSON.parse(JSON.stringify(updatedClass)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteClass(classId: string) {
    try {
        dbDeleteClass(classId);
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function getTeacherStats(year: number, month: number) {
    try {
        const stats = dbGetTeacherStats(year, month);
        return { success: true, stats };
    } catch (error) {
        return { success: false, error: (error as Error).message, stats: {} };
    }
}


function convertToCsv(data: any[], headers: Record<string, string>) {
    const headerKeys = Object.keys(headers);
    const headerRow = Object.values(headers).join(',');
    const dataRows = data.map(row => 
        headerKeys.map(key => {
            let cell = row[key] ?? '';
             if (cell instanceof Date) {
                cell = cell.toLocaleString('es-ES');
            } else if (Array.isArray(cell)) {
                 if (key === 'classes') {
                    cell = cell.map(item => `${item.name} (${new Date(item.date).toLocaleDateString('es-ES')} ${item.time})`).join('; ');
                 } else if (key === 'attendees') {
                    cell = cell.map(item => item.name).join('; ');
                 } else {
                    cell = JSON.stringify(cell);
                 }
            } else if (typeof cell === 'object' && cell !== null) {
                cell = JSON.stringify(cell);
            }
            const value = String(cell);
            return `"${value.replace(/"/g, '""')}"`;
        }).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
}

export async function getStudentCsv() {
    const bookings = dbGetBookings().map(b => ({
        name: b.student.name,
        email: b.student.email,
        phone: b.student.phone,
        bookingDate: b.bookingDate,
        packSize: `${b.packSize} clases`,
        price: `${b.price}€`,
        paymentStatus: b.paymentStatus === 'completed' ? 'Realizado' : 'Pendiente',
        classes: b.classes,
    }));
    const headers = {
        name: 'Nombre',
        email: 'Email',
        phone: 'Teléfono',
        bookingDate: 'Fecha de Reserva',
        packSize: 'Bono Seleccionado',
        price: 'Precio',
        paymentStatus: 'Estado del Pago',
        classes: 'Clases Reservadas',
    };
    return convertToCsv(bookings, headers);
}

export async function getClassCsv() {
    const classesWithAttendees = dbGetClassesWithAttendees();
    const flatData = classesWithAttendees
        .map(c => ({
            className: c.classDetails.name,
            date: new Date(c.classDetails.date),
            time: c.classDetails.time,
            teacher: c.classDetails.teacher,
            attendees: c.attendees,
            booked: c.classDetails.bookedSpots,
            total: c.classDetails.totalSpots,
        }));

    const headers = {
        className: 'Clase',
        date: 'Fecha',
        time: 'Hora',
        teacher: 'Profesor/a',
        booked: 'Plazas Ocupadas',
        total: 'Plazas Totales',
        attendees: 'Nombres de Asistentes',
    };
    return convertToCsv(flatData, headers);
}

// Pack Management Actions
export async function fetchPacks() {
    return dbGetClassPacks();
}

export async function addClassPack(packData: Omit<ClassPack, 'id'>) {
    try {
        const newPack = dbAddClassPack(packData);
        return { success: true, pack: JSON.parse(JSON.stringify(newPack)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function updateClassPack(packData: ClassPack) {
    try {
        const updatedPack = dbUpdateClassPack(packData);
        return { success: true, pack: JSON.parse(JSON.stringify(updatedPack)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteClassPack(packId: string) {
    try {
        dbDeleteClassPack(packId);
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}
