// NOTE: This is an in-memory data store for prototyping purposes.
// In a real application, you would use a database.

import type { AeroClass, Booking, Student, ClassPack } from "@/lib/types";

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


// --- Data Store ---

type DataStore = {
  classes: AeroClass[];
  bookings: Booking[];
  activeBookingMonth: Date | null;
  classPacks: ClassPack[];
};

// Use the global object to persist the store across hot reloads in development
declare global {
  var dataStore: DataStore | undefined;
}

// Initialize the store only if it doesn't exist
if (!global.dataStore) {
  const today = new Date();
  const classMonths = [-1, 0, 1, 2, 3, 4, 5, 6].map(offset => 
    new Date(today.getFullYear(), today.getMonth() + offset, 1)
  );
  
  global.dataStore = {
    classes: classMonths.flatMap(month => generateMockClasses(month)),
    bookings: [],
    activeBookingMonth: new Date(today.getFullYear(), today.getMonth(), 1),
    classPacks: [
        { id: '4', name: '4 Clases / mes', classes: 4, price: 65 },
        { id: '8', name: '8 Clases / mes', classes: 8, price: 110 },
        { id: '12', name: '12 Clases / mes', classes: 12, price: 150 },
    ],
  };
}

// Export a constant reference to the store
const store = global.dataStore;


// --- Service Functions ---

export function getActiveBookingMonth(): Date | null {
  return store.activeBookingMonth;
}

export function setActiveBookingMonth(year: number | null, month: number | null): Date | null {
    if (year === null || month === null) {
        store.activeBookingMonth = null;
    } else {
        store.activeBookingMonth = new Date(year, month, 1);
    }
    return store.activeBookingMonth;
}

export function getClasses(): AeroClass[] {
  return store.classes.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getBookings(): Booking[] {
  return store.bookings.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
}

export function addBooking(student: Student, selectedClasses: Pick<AeroClass, 'id'>[], packSize: number): Booking {
  const bookingId = `booking-${Date.now()}-${Math.random()}`;
  const fullClassDetails: AeroClass[] = [];
  
  const classUpdates = new Map<string, number>();
  
  // First, validate all classes and calculate spot changes
  for (const selectedClass of selectedClasses) {
      const classToBook = store.classes.find(c => c.id === selectedClass.id);
      if (!classToBook) {
          throw new Error(`La clase seleccionada ya no existe. Por favor, refresca la página.`);
      }
      if (classToBook.bookedSpots >= classToBook.totalSpots) {
          throw new Error(`La clase ${classToBook.name} del ${new Date(classToBook.date).toLocaleDateString()} a las ${classToBook.time} ya no tiene plazas.`);
      }
      classUpdates.set(classToBook.id, (classUpdates.get(classToBook.id) || 0) + 1);
      fullClassDetails.push(classToBook);
  }

  // Check if any class is overbooked by this single booking
  for (const [id, count] of classUpdates.entries()) {
    const classToBook = store.classes.find(c => c.id === id)!;
    if (classToBook.bookedSpots + count > classToBook.totalSpots) {
        throw new Error(`Intentando reservar ${count} plazas en la clase ${classToBook.name} pero solo quedan ${classToBook.totalSpots - classToBook.bookedSpots}.`);
    }
  }

  // If all validations pass, apply the changes
  for (const [id, count] of classUpdates.entries()) {
      const classIndex = store.classes.findIndex(c => c.id === id)!;
      store.classes[classIndex].bookedSpots += count;
  }
  
  const pack = store.classPacks.find(p => p.classes === packSize);
  if (!pack) {
      throw new Error(`No se encontró un bono para ${packSize} clases.`);
  }
  const price = pack.price;

  const newBooking: Booking = {
      id: bookingId,
      student,
      classes: fullClassDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      bookingDate: new Date(),
      packSize,
      price,
      paymentStatus: 'pending',
  };
  
  store.bookings.push(newBooking);
  return newBooking;
}

export function updateFullBooking(bookingId: string, updates: { student: Student, packSize: number, price: number, classIds: {id: string}[], paymentStatus: 'pending' | 'completed' }): Booking {
    const bookingIndex = store.bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) throw new Error("Reserva no encontrada");

    const booking = store.bookings[bookingIndex];
    
    // --- Step 1: Handle Class Changes ---
    const oldClassIds = booking.classes.map(c => c.id);
    const newClassIds = updates.classIds.map(c => c.id);

    // Calculate spot changes needed
    const spotChanges: Record<string, number> = {};
    oldClassIds.forEach(id => { spotChanges[id] = (spotChanges[id] || 0) - 1; });
    newClassIds.forEach(id => { spotChanges[id] = (spotChanges[id] || 0) + 1; });

    // Validate spot availability BEFORE applying any changes
    for (const classId in spotChanges) {
        if (spotChanges[classId] > 0) { // Only check for increments
            const classToBook = store.classes.find(c => c.id === classId);
            if (!classToBook) throw new Error(`Clase con ID ${classId} no encontrada.`);
            if ((classToBook.bookedSpots + spotChanges[classId]) > classToBook.totalSpots) {
                throw new Error(`La clase ${classToBook.name} no tiene suficientes plazas.`);
            }
        }
    }
    
    // Get full details for new classes
    const newFullClassDetails: AeroClass[] = [];
    newClassIds.forEach(id => {
        const cls = store.classes.find(c => c.id === id);
        if (cls) newFullClassDetails.push(cls);
    });
    if(newFullClassDetails.length !== newClassIds.length) {
      throw new Error("Una o más de las clases seleccionadas no se encontraron.");
    }
    
    // Apply spot changes
    for (const classId in spotChanges) {
        const classIndex = store.classes.findIndex(c => c.id === classId);
        if (classIndex !== -1) {
            store.classes[classIndex].bookedSpots += spotChanges[classId];
            if (store.classes[classIndex].bookedSpots < 0) store.classes[classIndex].bookedSpots = 0; // Sanity check
        }
    }
    
    // --- Step 2: Update Booking Details ---
    booking.student = updates.student;
    booking.packSize = updates.packSize;
    booking.price = updates.price;
    booking.paymentStatus = updates.paymentStatus;
    booking.classes = newFullClassDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Save the updated booking back to the store
    store.bookings[bookingIndex] = booking;

    return booking;
}

export function updateBookingStatus(bookingId: string, status: 'pending' | 'completed'): Booking {
    const bookingIndex = store.bookings.findIndex(b => b.id === bookingId);
    if (bookingIndex === -1) throw new Error("Reserva no encontrada");

    store.bookings[bookingIndex].paymentStatus = status;
    return store.bookings[bookingIndex];
}

export function getClassesWithAttendees() {
  const classMap = new Map<string, { classDetails: AeroClass; attendees: Student[] }>();

  // Initialize map with all classes to show empty ones too
  store.classes.forEach(cls => {
       classMap.set(cls.id, { classDetails: JSON.parse(JSON.stringify(cls)), attendees: [] });
  });
  
  // Populate with attendees from bookings
  store.bookings.forEach(booking => {
      booking.classes.forEach(cls => {
          if (classMap.has(cls.id)) {
              classMap.get(cls.id)!.attendees.push(booking.student);
          }
      });
  });

  return Array.from(classMap.values()).sort((a,b) => new Date(a.classDetails.date).getTime() - new Date(b.classDetails.date).getTime());
}

export function addClass(classData: Omit<AeroClass, 'id' | 'bookedSpots' | 'date'> & { date: string }): AeroClass {
  const newClass: AeroClass = {
      ...classData,
      id: `class-${Date.now()}`,
      date: new Date(classData.date),
      bookedSpots: 0,
  };
  store.classes.push(newClass);
  return newClass;
}

export function addRecurringClasses(data: {
    name: string;
    day: number;
    time: string;
    teacher: string;
    totalSpots: number;
    months: number[];
    year: number;
}): AeroClass[] {
    const createdClasses: AeroClass[] = [];
    data.months.forEach(monthIndex => {
        const daysInMonth = new Date(data.year, monthIndex + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(data.year, monthIndex, day);
            if (date.getDay() === data.day) {
                const existingClass = store.classes.find(c => 
                    c.date.getTime() === date.getTime() && c.time === data.time
                );
                if (!existingClass) {
                    const newClass: AeroClass = {
                        id: `class-${data.year}-${monthIndex + 1}-${day}-${data.time.replace(':', '')}-${Math.random()}`,
                        name: data.name,
                        date,
                        time: data.time,
                        totalSpots: data.totalSpots,
                        bookedSpots: 0,
                        teacher: data.teacher,
                    };
                    store.classes.push(newClass);
                    createdClasses.push(newClass);
                }
            }
        }
    });
    return createdClasses;
}

export function updateClass(classData: Omit<AeroClass, 'date'> & { date: string }): AeroClass | null {
    const classIndex = store.classes.findIndex(c => c.id === classData.id);
    if(classIndex === -1) return null;
    
    const updatedClass = {
        ...store.classes[classIndex],
        ...classData,
        date: new Date(classData.date)
    };
    store.classes[classIndex] = updatedClass;
    return updatedClass;
}

export function deleteClass(classId: string): boolean {
  const classIndex = store.classes.findIndex(c => c.id === classId);
  if(classIndex === -1) return false;

  if(store.classes[classIndex].bookedSpots > 0) {
    throw new Error("No se puede eliminar una clase que ya tiene reservas.");
  }
  
  store.classes.splice(classIndex, 1);
  return true;
}

export function getTeacherStats(year: number, month: number) {
    const stats: Record<string, number> = {};
    const classesInMonth = store.classes.filter(c => {
        const classDate = new Date(c.date);
        return classDate.getFullYear() === year && classDate.getMonth() === month;
    });

    classesInMonth.forEach(c => {
        if (c.teacher) {
            stats[c.teacher] = (stats[c.teacher] || 0) + 1;
        }
    });
    return stats;
}


// Pack Management
export function getClassPacks(): ClassPack[] {
    return store.classPacks;
}

export function addClassPack(packData: Omit<ClassPack, 'id'>): ClassPack {
    const newPack: ClassPack = {
        ...packData,
        id: packData.classes.toString(),
    };
    if (store.classPacks.some(p => p.id === newPack.id)) {
        throw new Error("Ya existe un bono con esa cantidad de clases.");
    }
    store.classPacks.push(newPack);
    return newPack;
}

export function updateClassPack(packData: ClassPack): ClassPack {
    const packIndex = store.classPacks.findIndex(p => p.id === packData.id);
    if (packIndex === -1) {
        throw new Error("Bono no encontrado.");
    }

    const newId = packData.classes.toString();
    // Check if the ID is being changed, and if so, if the new ID is already taken by another pack.
    if (newId !== packData.id && store.classPacks.some(p => p.id === newId)) {
        throw new Error("Ya existe un bono con esa cantidad de clases.");
    }
    
    // The incoming `packData` still has the old `id`. We need to create the updated object with the new `id`.
    store.classPacks[packIndex] = { ...packData, id: newId };
    return store.classPacks[packIndex];
}

export function deleteClassPack(packId: string): boolean {
    const packIndex = store.classPacks.findIndex(p => p.id === packId);
    if (packIndex === -1) return false;
    store.classPacks.splice(packIndex, 1);
    return true;
}
