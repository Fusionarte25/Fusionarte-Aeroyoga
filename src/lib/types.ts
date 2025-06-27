export interface AeroClass {
  id: string;
  name: string;
  date: Date;
  time: string;
  totalSpots: number;
  bookedSpots: number;
  teacher?: string;
}

export interface Student {
  name: string;
  email: string;
  phone: string;
}

export interface Booking {
  id: string;
  student: Student;
  classes: AeroClass[];
  bookingDate: Date;
  packSize: number;
  price: number;
}
