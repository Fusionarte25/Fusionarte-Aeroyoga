'use server'

import * as db from '@/lib/data'
import type { AeroClass, Student, Booking, ClassPack } from '@/lib/types'

export async function fetchClasses() {
  const allClasses = await db.getClasses();
  return JSON.parse(JSON.stringify(allClasses));
}

export async function getActiveBookingMonth() {
    const activeMonth = await db.getActiveBookingMonth();
    return activeMonth?.toISOString() ?? null;
}

export async function setActiveBookingMonth(year: number | null, month: number | null) {
    const newActiveMonth = await db.setActiveBookingMonth(year, month);
    return newActiveMonth?.toISOString() ?? null;
}

export async function createBooking(student: Student, selectedClasses: Pick<AeroClass, 'id'>[], packSize: number, price: number) {
  try {
    const booking = await db.addBooking(student, selectedClasses, packSize, price);
    return { success: true, booking: JSON.parse(JSON.stringify(booking)) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFullBooking(bookingId: number, updates: { student: Student, packSize: number, price: number, classIds: {id: string}[], paymentStatus: 'pending' | 'completed' }) {
    try {
        const updatedBooking = await db.updateFullBooking(bookingId, updates);
        return { success: true, booking: JSON.parse(JSON.stringify(updatedBooking)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function updateBookingStatus(bookingId: number, status: 'pending' | 'completed') {
    try {
        const updatedBooking = await db.updateBookingStatus(bookingId, status);
        return { success: true, booking: JSON.parse(JSON.stringify(updatedBooking)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteBooking(bookingId: number) {
    try {
        await db.deleteBooking(bookingId);
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}


export async function fetchAdminData() {
    const [bookings, classesWithAttendees, allClasses] = await Promise.all([
        db.getBookings(),
        db.getClassesWithAttendees(),
        db.getClasses()
    ]);

    return { 
        bookings: JSON.parse(JSON.stringify(bookings)), 
        classesWithAttendees: JSON.parse(JSON.stringify(classesWithAttendees)),
        allClasses: JSON.parse(JSON.stringify(allClasses)),
    };
}

export async function addClass(classData: Omit<AeroClass, 'id' | 'bookedSpots' | 'date'> & { date: string }) {
    try {
        const newClass = await db.addClass(classData);
        return { success: true, class: JSON.parse(JSON.stringify(newClass)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function addRecurringClasses(data: any) {
    try {
        const newClasses = await db.addRecurringClasses(data);
        return { success: true, classes: JSON.parse(JSON.stringify(newClasses)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function updateClass(classData: Omit<AeroClass, 'date'> & { date: string }) {
    try {
        const updatedClass = await db.updateClass(classData);
        if (!updatedClass) throw new Error("Class not found");
        return { success: true, class: JSON.parse(JSON.stringify(updatedClass)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteClass(classId: string) {
    try {
        await db.deleteClass(classId);
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function getTeacherStats(year: number, month: number) {
    try {
        const stats = await db.getTeacherStats(year, month);
        return { success: true, stats };
    } catch (error) {
        console.error("Could not fetch teacher stats. This is likely a DB connection/setup issue.", error);
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
                    cell = cell.map(item => `${item.name} (${new Date(item.date).toLocaleDateString('es-ES')} ${item.time ? item.time.slice(0, 5) : ''})`).join('; ');
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
    const bookings = (await db.getBookings()).map(b => ({
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
    const classesWithAttendees = await db.getClassesWithAttendees();
    const flatData = classesWithAttendees
        .map(c => ({
            className: c.classDetails.name,
            date: new Date(c.classDetails.date),
            time: c.classDetails.time ? c.classDetails.time.slice(0, 5) : '',
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

// Custom Pack Price Actions
export async function getCustomPackPrices() {
    return await db.getCustomPackPrices();
}

export async function updateCustomPackPrices(prices: Record<string, number>) {
    try {
        const newPrices = await db.updateCustomPackPrices(prices);
        return { success: true, prices: newPrices };
    } catch (error) {
        console.error('Error in updateCustomPackPrices. This is likely a DB connection/setup issue.', error);
        return { success: false, error: (error as Error).message };
    }
}

// Pack Management Actions
export async function fetchPacks() {
    return await db.getClassPacks();
}

export async function addClassPack(packData: ClassPack) {
    try {
        const newPack = await db.addClassPack(packData);
        return { success: true, pack: JSON.parse(JSON.stringify(newPack)) };
    } catch (error) {
        console.error('Error in addClassPack. This is likely a DB connection/setup issue.', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function updateClassPack(packData: ClassPack) {
    try {
        const updatedPack = await db.updateClassPack(packData);
        return { success: true, pack: JSON.parse(JSON.stringify(updatedPack)) };
    } catch (error) {
        console.error('Error in updateClassPack. This is likely a DB connection/setup issue.', error);
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteClassPack(packId: string) {
    try {
        await db.deleteClassPack(packId);
        return { success: true };
    } catch (error) {
        console.error('Error in deleteClassPack. This is likely a DB connection/setup issue.', error);
        return { success: false, error: (error as Error).message };
    }
}
