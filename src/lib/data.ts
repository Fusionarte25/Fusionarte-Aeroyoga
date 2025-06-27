// NOTE: This is an in-memory data store for prototyping purposes.
// In a real application, you would use a database.

import type { AeroClass, Booking, Student } from "@/lib/types";

const schedule = [
  // Martes
  { day: 2, time: "17:00", name: "Aeroyoga Intermedio", teacher: "Ana" },
  { day: 2, time: "18:00", name: "Aeroyoga Principiante", teacher: "Ana" },
  // Miércoles
  { day: 3, time: "08:15", name: "Aeroyoga Principiantes", teacher: "Laura" },
  { day: 3, time: "17:00", name: "Aeroyoga Principiante", teacher: "Ana" },
  { day: 3, time: "18:00", name: "Aeroyoga Intermedio", teacher: "Ana" },
  // Jueves
  { day: 4, time: "17:30", name: "Aeroyoga Mixto", teacher: "Laura" },
  // Sábado
  { day: 6, time: "10:00", name: "Aeroyoga Intermedio", teacher: "Ana" },
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
    return JSON.parse(JSON.stringify(this.classes));
  }

  getBookings(): Booking[] {
    return JSON.parse(JSON.stringify(this.bookings));
  }
  
  addBooking(student: Student, selectedClasses: Pick<AeroClass, 'id'>[], packSize: number): Booking {
    const bookingId = `booking-${Date.now()}-${Math.random()}`;
    const fullClassDetails: AeroClass[] = [];

    selectedClasses.forEach(selectedClass => {
        const classIndex = this.classes.findIndex(c => c.id === selectedClass.id);
        if (classIndex !== -1 && this.classes[classIndex].bookedSpots < this.classes[classIndex].totalSpots) {
            this.classes[classIndex].bookedSpots++;
            fullClassDetails.push(this.classes[classIndex]);
        } else {
            console.warn(`Class ${selectedClass.id} is full or does not exist.`);
        }
    });

    if (fullClassDetails.length !== selectedClasses.length) {
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
        bookingDate: new Date(),
        packSize
    };
    
    this.bookings.push(newBooking);
    return newBooking;
  }
  
  getClassesWithAttendees() {
    const classMap = new Map<string, { classDetails: AeroClass; attendees: Student[] }>();

    this.bookings.forEach(booking => {
        booking.classes.forEach(cls => {
            const currentClassDetails = this.classes.find(c => c.id === cls.id);
            if (!currentClassDetails) return;

            if (!classMap.has(cls.id)) {
                classMap.set(cls.id, { classDetails: currentClassDetails, attendees: [] });
            }
            classMap.get(cls.id)!.attendees.push(booking.student);
        });
    });

    this.classes.forEach(cls => {
        if (!classMap.has(cls.id)) {
             classMap.set(cls.id, { classDetails: cls, attendees: [] });
        }
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

export const bookingService = BookingService.getInstance();
