// NOTE: This is an in-memory data store for prototyping purposes.
// In a real application, you would use a database.

import type { AeroClass, Booking, Student } from "@/lib/types";

const PACK_PRICES: { [key: number]: number } = {
    4: 65,
    8: 110,
    12: 150,
};

const schedule = [
  // Martes
  { day: 2, time: "17:00", name: "Aeroyoga Intermedio", teacher: "Alexandra" },
  { day: 2, time: "18:00", name: "Aeroyoga Principiante", teacher: "Alexandra" },
  // Miércoles
  { day: 3, time: "08:15", name: "Aeroyoga Principiantes", teacher: "Alexandra" },
  { day: 3, time: "17:00", name: "Aeroyoga Principiante", teacher: "Alexandra" },
  { day: 3, time: "18:00", name: "Aeroyoga Intermedio", teacher: "Alexandra" },
  // Jueves
  { day: 4, time: "17:30", name: "Aeroyoga Mixto", teacher: "Alexandra" },
  // Sábado
  { day: 6, time: "10:00", name: "Aeroyoga Intermedio", teacher: "Alexandra" },
];

const generateMockClasses = (month: Date): AeroClass[] => {
  const classes: AeroClass[] = [];
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ... , 6 = Sábado

    schedule.forEach(scheduledClass => {
      // Ajuste: si getDay() devuelve 0 (Domingo), lo mapeamos a 7 para que coincida con una posible lógica de 1-7
      const effectiveDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
      
      if (effectiveDayOfWeek === scheduledClass.day) {
        classes.push({
          id: `class-${year}-${monthIndex + 1}-${day}-${scheduledClass.time.replace(':', '')}`,
          name: scheduledClass.name,
          date,
          time: scheduledClass.time,
          totalSpots: 7,
          bookedSpots: 0,
          teacher: scheduledClass.teacher
        });
      }
    });
  }
  return classes;
};


class BookingService {
  private classes: AeroClass[] = [];
  private bookings: Booking[] = [];
  private static instance: BookingService;
  private activeBookingMonth: Date;

  private constructor() {
    const today = new Date();
    // Default active month is the current month
    this.activeBookingMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Generate classes for a few months around today to have data available
    const classMonths = [-1, 0, 1, 2, 3, 4, 5, 6].map(offset => {
      return new Date(today.getFullYear(), today.getMonth() + offset, 1);
    });

    this.classes = classMonths.flatMap(month => generateMockClasses(month));
  }

  public static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService();
    }
    return BookingService.instance;
  }

  getActiveBookingMonth(): Date {
      return this.activeBookingMonth;
  }

  setActiveBookingMonth(year: number, month: number): Date {
      this.activeBookingMonth = new Date(year, month, 1);
      return this.activeBookingMonth;
  }

  getClasses(): AeroClass[] {
    return JSON.parse(JSON.stringify(this.classes.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())));
  }

  getBookings(): Booking[] {
    return JSON.parse(JSON.stringify(this.bookings.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())));
  }
  
  addBooking(student: Student, selectedClasses: Pick<AeroClass, 'id'>[], packSize: number): Booking {
    const bookingId = `booking-${Date.now()}-${Math.random()}`;
    const fullClassDetails: AeroClass[] = [];
    const bookedClassIndexes: number[] = [];

    selectedClasses.forEach(selectedClass => {
        const classIndex = this.classes.findIndex(c => c.id === selectedClass.id);
        if (classIndex !== -1 && this.classes[classIndex].bookedSpots < this.classes[classIndex].totalSpots) {
            this.classes[classIndex].bookedSpots++;
            bookedClassIndexes.push(classIndex);
            fullClassDetails.push(this.classes[classIndex]);
        } else {
             // Rollback if a class is not bookable
            bookedClassIndexes.forEach(idx => {
                this.classes[idx].bookedSpots--;
            });
            const failedClass = this.classes.find(c => c.id === selectedClass.id);
            if (!failedClass) throw new Error(`La clase seleccionada ya no existe. Por favor, refresca la página.`);
            throw new Error(`La clase ${failedClass.name} del ${failedClass.date.toLocaleDateString()} a las ${failedClass.time} ya no tiene plazas.`);
        }
    });

    if (fullClassDetails.length !== selectedClasses.length) {
        // This case should ideally not be hit due to the check above, but as a safeguard:
        bookedClassIndexes.forEach(classIndex => {
            this.classes[classIndex].bookedSpots--;
        });
        throw new Error("Una o más clases seleccionadas ya no tienen plazas disponibles. Por favor, revisa tu selección.");
    }
    
    const price = PACK_PRICES[packSize] || 0;

    const newBooking: Booking = {
        id: bookingId,
        student,
        classes: fullClassDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        bookingDate: new Date(),
        packSize,
        price,
    };
    
    this.bookings.push(newBooking);
    return newBooking;
  }

  updateBookingClasses(bookingId: string, newSelectedClassIds: Pick<AeroClass, 'id'>[]): Booking {
      const bookingIndex = this.bookings.findIndex(b => b.id === bookingId);
      if (bookingIndex === -1) throw new Error("Reserva no encontrada");

      const booking = this.bookings[bookingIndex];
      
      if (newSelectedClassIds.length !== booking.packSize) {
          throw new Error(`La selección debe ser de ${booking.packSize} clases.`);
      }

      const oldClassIds = booking.classes.map(c => c.id);
      const newIds = newSelectedClassIds.map(c => c.id);

      const spotChanges: Record<string, number> = {};
      oldClassIds.forEach(id => { spotChanges[id] = (spotChanges[id] || 0) - 1; });
      newIds.forEach(id => { spotChanges[id] = (spotChanges[id] || 0) + 1; });

      // First, check if all new spots are available BEFORE making changes
      for (const classId in spotChanges) {
          if (spotChanges[classId] > 0) { // Only check for increments
              const classToBook = this.classes.find(c => c.id === classId);
              if (!classToBook) throw new Error(`Clase con ID ${classId} no encontrada.`);
              if ((classToBook.bookedSpots + spotChanges[classId]) > classToBook.totalSpots) {
                  throw new Error(`La clase ${classToBook.name} no tiene suficientes plazas.`);
              }
          }
      }

      const newFullClassDetails: AeroClass[] = [];
      newIds.forEach(id => {
          const cls = this.classes.find(c => c.id === id);
          if (cls) newFullClassDetails.push(cls);
      });
      if(newFullClassDetails.length !== newIds.length) {
        throw new Error("Una o más de las clases seleccionadas no se encontraron.");
      }
      
      // If all checks passed, apply the changes
      for (const classId in spotChanges) {
          const classIndex = this.classes.findIndex(c => c.id === classId);
          if (classIndex !== -1) {
              this.classes[classIndex].bookedSpots += spotChanges[classId];
          }
      }
      
      booking.classes = newFullClassDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      this.bookings[bookingIndex] = booking;

      return booking;
  }
  
  getClassesWithAttendees() {
    const classMap = new Map<string, { classDetails: AeroClass; attendees: Student[] }>();

    // Initialize map with all classes to show empty ones too
    this.classes.forEach(cls => {
         classMap.set(cls.id, { classDetails: JSON.parse(JSON.stringify(cls)), attendees: [] });
    });
    
    // Populate with attendees from bookings
    this.bookings.forEach(booking => {
        booking.classes.forEach(cls => {
            if (classMap.has(cls.id)) {
                classMap.get(cls.id)!.attendees.push(booking.student);
            }
        });
    });

    return Array.from(classMap.values()).sort((a,b) => new Date(a.classDetails.date).getTime() - new Date(b.classDetails.date).getTime());
  }

  addClass(classData: Omit<AeroClass, 'id' | 'bookedSpots' | 'date'> & { date: string }): AeroClass {
    const newClass: AeroClass = {
        ...classData,
        id: `class-${Date.now()}`,
        date: new Date(classData.date),
        bookedSpots: 0,
    };
    this.classes.push(newClass);
    return newClass;
  }

  updateClass(classData: Omit<AeroClass, 'date'> & { date: string }): AeroClass | null {
      const classIndex = this.classes.findIndex(c => c.id === classData.id);
      if(classIndex === -1) return null;
      
      const updatedClass = {
          ...this.classes[classIndex],
          ...classData,
          date: new Date(classData.date)
      };
      this.classes[classIndex] = updatedClass;
      return updatedClass;
  }

  deleteClass(classId: string): boolean {
    const classIndex = this.classes.findIndex(c => c.id === classId);
    if(classIndex === -1) return false;

    // A simple check: do not delete if class has bookings.
    if(this.classes[classIndex].bookedSpots > 0) {
      throw new Error("No se puede eliminar una clase que ya tiene reservas.");
    }
    
    this.classes.splice(classIndex, 1);
    return true;
  }
}

// Singleton implementation to work with Next.js hot-reloading in development
const globalForBookingService = global as unknown as {
  bookingService: BookingService | undefined;
};

export const bookingService =
  globalForBookingService.bookingService ?? BookingService.getInstance();

if (process.env.NODE_ENV !== 'production') {
  globalForBookingService.bookingService = bookingService;
}
