// NOTE: This is an in-memory data store for prototyping purposes.
// In a real application, you would use a database.

import type { AeroClass, Booking, Student } from "@/lib/types";

const schedule = [
  // Martes
  { day: 2, time: "17:00", name: "Aeroyoga Intermedio" },
  { day: 2, time: "18:00", name: "Aeroyoga Principiante" },
  // Miércoles
  { day: 3, time: "08:15", name: "Aeroyoga Principiantes" },
  { day: 3, time: "17:00", name: "Aeroyoga Principiante" },
  { day: 3, time: "18:00", name: "Aeroyoga Intermedio" },
  // Jueves
  { day: 4, time: "17:30", name: "Aeroyoga Mixto" },
  // Sábado
  { day: 6, time: "10:00", name: "Aeroyoga Intermedio" },
];

const generateMockClasses = (month: Date): AeroClass[] => {
  const classes: AeroClass[] = [];
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    if (date < today) continue;

    const dayOfWeek = date.getDay();

    schedule.forEach(scheduledClass => {
      if (dayOfWeek === scheduledClass.day) {
        classes.push({
          id: `class-${year}-${monthIndex + 1}-${day}-${scheduledClass.time.replace(':', '')}`,
          name: scheduledClass.name,
          date,
          time: scheduledClass.time,
          totalSpots: 7,
          bookedSpots: 0,
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

  private constructor() {
    const thisMonth = new Date();
    const nextMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 1);
    this.classes = [
        ...generateMockClasses(thisMonth),
        ...generateMockClasses(nextMonth)
    ];
  }

  public static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService();
    }
    return BookingService.instance;
  }

  getClasses(): AeroClass[] {
    // Return a deep copy to prevent mutation of original data on client
    return JSON.parse(JSON.stringify(this.classes));
  }

  getBookings(): Booking[] {
    // Return a deep copy
    return JSON.parse(JSON.stringify(this.bookings));
  }
  
  addBooking(student: Student, selectedClasses: Pick<AeroClass, 'id'>[]): Booking {
    const bookingId = `booking-${Date.now()}-${Math.random()}`;
    const fullClassDetails: AeroClass[] = [];

    selectedClasses.forEach(selectedClass => {
        const classIndex = this.classes.findIndex(c => c.id === selectedClass.id);
        if (classIndex !== -1 && this.classes[classIndex].bookedSpots < this.classes[classIndex].totalSpots) {
            this.classes[classIndex].bookedSpots++;
            fullClassDetails.push(this.classes[classIndex]);
        } else {
            // If a class is full, we shouldn't proceed with the booking for that class
            console.warn(`Class ${selectedClass.id} is full or does not exist.`);
        }
    });

    if (fullClassDetails.length !== selectedClasses.length) {
        // Rollback booked spots if not all classes could be booked
        fullClassDetails.forEach(bookedClass => {
            const classIndex = this.classes.findIndex(c => c.id === bookedClass.id);
            if (classIndex !== -1) {
                this.classes[classIndex].bookedSpots--;
            }
        });
        throw new Error("Una o más clases seleccionadas ya no tienen plazas disponibles. Por favor, revisa tu selección.");
    }
    
    const newBooking: Booking = {
        id: bookingId,
        student,
        classes: fullClassDetails,
        bookingDate: new Date()
    };
    
    this.bookings.push(newBooking);
    return newBooking;
  }
  
  getClassesWithAttendees() {
    const classMap = new Map<string, { classDetails: AeroClass; attendees: Student[] }>();

    this.bookings.forEach(booking => {
        booking.classes.forEach(cls => {
            // Find the most up-to-date class details from the source
            const currentClassDetails = this.classes.find(c => c.id === cls.id);
            if (!currentClassDetails) return;

            if (!classMap.has(cls.id)) {
                classMap.set(cls.id, { classDetails: currentClassDetails, attendees: [] });
            }
            classMap.get(cls.id)!.attendees.push(booking.student);
        });
    });

    // Also include classes that have no attendees yet
    this.classes.forEach(cls => {
        if (!classMap.has(cls.id)) {
             classMap.set(cls.id, { classDetails: cls, attendees: [] });
        }
    });

    return Array.from(classMap.values()).sort((a,b) => new Date(a.classDetails.date).getTime() - new Date(b.classDetails.date).getTime());
  }
}

export const bookingService = BookingService.getInstance();
