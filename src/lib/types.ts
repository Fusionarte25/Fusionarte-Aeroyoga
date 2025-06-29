export interface ClassPack {
  id: string;
  name: string;
  classes: number;
  price: number;
  type: 'standard' | 'fixed_monthly';
}

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
  id: number; // Changed to number to match database SERIAL type
  student: Student;
  classes: AeroClass[];
  bookingDate: Date;
  packSize: number;
  price: number;
  paymentStatus: 'pending' | 'completed';
}
