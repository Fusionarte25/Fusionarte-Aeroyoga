'use server'

import { bookingService } from '@/lib/data'
import type { AeroClass, Student } from '@/lib/types'

export async function fetchClasses() {
  return bookingService.getClasses()
}

export async function createBooking(student: Student, selectedClasses: Pick<AeroClass, 'id'>[], packSize: number) {
  try {
    const booking = bookingService.addBooking(student, selectedClasses, packSize);
    return { success: true, booking: JSON.parse(JSON.stringify(booking)) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function fetchAdminData() {
    const bookings = bookingService.getBookings();
    const classesWithAttendees = bookingService.getClassesWithAttendees();
    return { 
        bookings: JSON.parse(JSON.stringify(bookings)), 
        classesWithAttendees: JSON.parse(JSON.stringify(classesWithAttendees)) 
    };
}

export async function addClass(classData: Omit<AeroClass, 'id' | 'bookedSpots' | 'date'> & { date: string }) {
    try {
        const newClass = bookingService.addClass(classData);
        return { success: true, class: JSON.parse(JSON.stringify(newClass)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function updateClass(classData: Omit<AeroClass, 'date'> & { date: string }) {
    try {
        const updatedClass = bookingService.updateClass(classData);
        if (!updatedClass) throw new Error("Class not found");
        return { success: true, class: JSON.parse(JSON.stringify(updatedClass)) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteClass(classId: string) {
    try {
        bookingService.deleteClass(classId);
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
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
    const bookings = bookingService.getBookings().map(b => ({
        name: b.student.name,
        email: b.student.email,
        phone: b.student.phone,
        bookingDate: b.bookingDate,
        packSize: `${b.packSize} clases`,
        price: `${b.price}€`,
        classes: b.classes,
    }));
    const headers = {
        name: 'Nombre',
        email: 'Email',
        phone: 'Teléfono',
        bookingDate: 'Fecha de Reserva',
        packSize: 'Bono Seleccionado',
        price: 'Precio',
        classes: 'Clases Reservadas',
    };
    return convertToCsv(bookings, headers);
}

export async function getClassCsv() {
    const classesWithAttendees = bookingService.getClassesWithAttendees();
    const flatData = classesWithAttendees.map(c => ({
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
