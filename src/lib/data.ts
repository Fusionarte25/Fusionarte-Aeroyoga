// --- Imports ---
import { pool } from './db';
import type { AeroClass, Booking, Student, ClassPack } from "@/lib/types";

// --- Helper Functions ---
const mapToAeroClass = (row: any): AeroClass => ({
  id: row.id,
  name: row.name,
  date: new Date(row.date),
  time: row.time,
  totalSpots: parseInt(row.total_spots, 10),
  bookedSpots: parseInt(row.booked_spots, 10),
  teacher: row.teacher,
});

const mapToBooking = (row: any, classes: AeroClass[]): Booking => ({
  id: parseInt(row.id, 10),
  student: {
    name: row.student_name,
    email: row.student_email,
    phone: row.student_phone,
  },
  classes: classes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  bookingDate: new Date(row.booking_date),
  packSize: parseInt(row.pack_size, 10),
  price: parseFloat(row.price),
  paymentStatus: row.payment_status,
});

// --- Service Functions ---

export async function getActiveBookingMonth(): Promise<Date | null> {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'activeBookingMonth'");
    if (result.rows.length === 0 || !result.rows[0].value) {
      // If no setting found, return a sensible default but don't write to DB.
      // The setup script is responsible for the initial state.
      const defaultMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      return defaultMonth;
    }
    return new Date(result.rows[0].value);
  } catch (error) {
      console.error("Could not fetch active booking month, returning default. Please run DB setup script.", error);
      return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }
}

export async function setActiveBookingMonth(year: number | null, month: number | null): Promise<Date | null> {
  const client = await pool.connect();
  try {
    let newActiveMonth: Date | null;
    if (year === null || month === null) {
      newActiveMonth = null;
    } else {
      newActiveMonth = new Date(year, month, 1);
    }
    
    await client.query(
      "INSERT INTO settings (key, value) VALUES ('activeBookingMonth', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [newActiveMonth ? newActiveMonth.toISOString() : null]
    );
    return newActiveMonth;
  } finally {
    client.release();
  }
}

export async function getClasses(): Promise<AeroClass[]> {
  try {
    const result = await pool.query('SELECT * FROM classes ORDER BY date, time ASC');
    return result.rows.map(mapToAeroClass);
  } catch (error) {
    console.error("Could not fetch classes. Please run DB setup script.", error);
    return [];
  }
}

export async function getBookings(): Promise<Booking[]> {
  try {
    const bookingResult = await pool.query('SELECT * FROM bookings ORDER BY booking_date DESC');
    if (bookingResult.rows.length === 0) return [];

    const allClassIds = [...new Set(bookingResult.rows.flatMap(b => b.class_ids))];
    
    if (allClassIds.length === 0) {
        return bookingResult.rows.map(row => mapToBooking(row, []));
    }

    const classResult = await pool.query('SELECT * FROM classes WHERE id = ANY($1::text[])', [allClassIds]);
    const classesById = new Map(classResult.rows.map(mapToAeroClass).map(c => [c.id, c]));

    return bookingResult.rows.map(row => {
      const bookingClasses = row.class_ids.map((id: string) => classesById.get(id)).filter(Boolean) as AeroClass[];
      return mapToBooking(row, bookingClasses);
    });
  } catch (error) {
    console.error("Could not fetch bookings. Please run DB setup script.", error);
    return [];
  }
}

export async function addBooking(student: Student, selectedClasses: Pick<AeroClass, 'id'>[], packSize: number, price: number): Promise<Booking> {
  const client = await pool.connect();
  const classIds = selectedClasses.map(c => c.id);

  try {
    await client.query('BEGIN');

    const classesResult = await client.query('SELECT * FROM classes WHERE id = ANY($1::text[]) FOR UPDATE', [classIds]);
    
    if (classesResult.rows.length !== classIds.length) {
      throw new Error('Una o más clases seleccionadas ya no existen. Por favor, refresca la página.');
    }

    const classesToBook: AeroClass[] = classesResult.rows.map(mapToAeroClass);
    
    for (const cls of classesToBook) {
      if (cls.bookedSpots >= cls.totalSpots) {
        throw new Error(`La clase ${cls.name} del ${new Date(cls.date).toLocaleDateString()} a las ${cls.time} ya no tiene plazas.`);
      }
    }

    const updatePromises = classIds.map(id => 
      client.query('UPDATE classes SET booked_spots = booked_spots + 1 WHERE id = $1', [id])
    );
    await Promise.all(updatePromises);

    const bookingInsertResult = await client.query(
      `INSERT INTO bookings (student_name, student_email, student_phone, pack_size, price, payment_status, class_ids)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [student.name, student.email, student.phone, packSize, price, classIds]
    );

    const newBookingRow = bookingInsertResult.rows[0];
    
    await client.query('COMMIT');
    
    return mapToBooking(newBookingRow, classesToBook);

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updateFullBooking(bookingId: number, updates: { student: Student, packSize: number, price: number, classIds: {id: string}[], paymentStatus: 'pending' | 'completed' }): Promise<Booking> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const oldBookingResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
        if (oldBookingResult.rows.length === 0) throw new Error("Reserva no encontrada");
        
        const oldClassIds: string[] = oldBookingResult.rows[0].class_ids;
        const newClassIds: string[] = updates.classIds.map(c => c.id);

        const spotChanges: Record<string, number> = {};
        oldClassIds.forEach(id => { spotChanges[id] = (spotChanges[id] || 0) - 1; });
        newClassIds.forEach(id => { spotChanges[id] = (spotChanges[id] || 0) + 1; });
        
        const allInvolvedClassIds = Object.keys(spotChanges);
        if (allInvolvedClassIds.length > 0) {
            const classesResult = await client.query('SELECT * FROM classes WHERE id = ANY($1::text[]) FOR UPDATE', [allInvolvedClassIds]);
            const classesById = new Map(classesResult.rows.map(mapToAeroClass).map(c => [c.id, c]));

            for (const classId in spotChanges) {
                const change = spotChanges[classId];
                if (change > 0) {
                    const cls = classesById.get(classId);
                    if (!cls) throw new Error(`Clase con ID ${classId} no encontrada.`);
                    if ((cls.bookedSpots + change) > cls.totalSpots) {
                        throw new Error(`La clase ${cls.name} no tiene suficientes plazas.`);
                    }
                }
            }
            
            for (const classId in spotChanges) {
              const change = spotChanges[classId];
              if (change !== 0) {
                  await client.query('UPDATE classes SET booked_spots = booked_spots + $1 WHERE id = $2', [change, classId]);
              }
            }
        }

        const updateBookingResult = await client.query(
            `UPDATE bookings SET
              student_name = $1, student_email = $2, student_phone = $3,
              pack_size = $4, price = $5, payment_status = $6, class_ids = $7
            WHERE id = $8
            RETURNING *`,
            [
              updates.student.name, updates.student.email, updates.student.phone,
              updates.packSize, updates.price, updates.paymentStatus, newClassIds,
              bookingId
            ]
        );
        
        const updatedBookingRow = updateBookingResult.rows[0];
        
        const finalClassIds = updatedBookingRow.class_ids;
        const finalClasses = finalClassIds.length > 0
          ? (await client.query('SELECT * FROM classes WHERE id = ANY($1::text[])', [finalClassIds])).rows.map(mapToAeroClass)
          : [];

        await client.query('COMMIT');
        
        return mapToBooking(updatedBookingRow, finalClasses);

    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function updateBookingStatus(bookingId: number, status: 'pending' | 'completed'): Promise<Booking> {
    const result = await pool.query(
        "UPDATE bookings SET payment_status = $1 WHERE id = $2 RETURNING *",
        [status, bookingId]
    );
    if (result.rows.length === 0) throw new Error("Reserva no encontrada");

    const updatedBookingRow = result.rows[0];
    const classesResult = updatedBookingRow.class_ids.length > 0
        ? await pool.query('SELECT * FROM classes WHERE id = ANY($1::text[])', [updatedBookingRow.class_ids])
        : { rows: [] };
    const classes = classesResult.rows.map(mapToAeroClass);
    
    return mapToBooking(updatedBookingRow, classes);
}

export async function getClassesWithAttendees() {
  const [classes, bookings] = await Promise.all([getClasses(), getBookings()]);
  
  const classMap = new Map<string, { classDetails: AeroClass; attendees: Student[] }>();

  classes.forEach(cls => {
       classMap.set(cls.id, { classDetails: cls, attendees: [] });
  });
  
  bookings.forEach(booking => {
      booking.classes.forEach(cls => {
          if (classMap.has(cls.id)) {
              classMap.get(cls.id)!.attendees.push(booking.student);
          }
      });
  });

  return Array.from(classMap.values()).sort((a,b) => new Date(a.classDetails.date).getTime() - new Date(b.classDetails.date).getTime());
}

export async function addClass(classData: Omit<AeroClass, 'id' | 'bookedSpots' | 'date'> & { date: string }): Promise<AeroClass> {
  const { name, date, time, totalSpots, teacher } = classData;
  const dateObj = new Date(date);
  dateObj.setUTCHours(0, 0, 0, 0); // Normalize date to avoid timezone issues
  const newId = `class-${dateObj.getTime()}-${time.replace(':', '')}`;
  
  const result = await pool.query(
    'INSERT INTO classes (id, name, date, time, total_spots, teacher) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING RETURNING *',
    [newId, name, date, time, totalSpots, teacher]
  );
  if (result.rows.length === 0) {
    throw new Error("Una clase idéntica ya existe en esa fecha y hora.");
  }
  return mapToAeroClass(result.rows[0]);
}

export async function addRecurringClasses(data: {
    name: string; day: number; time: string; teacher: string; totalSpots: number; months: number[]; year: number;
}): Promise<AeroClass[]> {
    const createdClasses: AeroClass[] = [];
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        for (const monthIndex of data.months) {
            const daysInMonth = new Date(data.year, monthIndex + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(Date.UTC(data.year, monthIndex, day));
                if (date.getUTCDay() === data.day) {
                    const newId = `class-${date.getTime()}-${data.time.replace(':', '')}`;
                    const result = await client.query(
                        `INSERT INTO classes (id, name, date, time, total_spots, teacher) 
                         VALUES ($1, $2, $3, $4, $5, $6) 
                         ON CONFLICT (id) DO NOTHING
                         RETURNING *`,
                         [newId, data.name, date.toISOString().split('T')[0], data.time, data.totalSpots, data.teacher]
                    );
                    if (result.rows.length > 0) {
                        createdClasses.push(mapToAeroClass(result.rows[0]));
                    }
                }
            }
        }
        await client.query('COMMIT');
        return createdClasses;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function updateClass(classData: Omit<AeroClass, 'date'> & { date: string }): Promise<AeroClass | null> {
    const { id, name, date, time, totalSpots, teacher } = classData;
    const result = await pool.query(
        'UPDATE classes SET name = $1, date = $2, time = $3, total_spots = $4, teacher = $5 WHERE id = $6 RETURNING *',
        [name, new Date(date), time, totalSpots, teacher, id]
    );
    if (result.rows.length === 0) return null;
    return mapToAeroClass(result.rows[0]);
}

export async function deleteClass(classId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classResult = await client.query('SELECT booked_spots FROM classes WHERE id = $1 FOR UPDATE', [classId]);
    if (classResult.rows.length === 0) throw new Error("Class not found");
    if (classResult.rows[0].booked_spots > 0) {
      throw new Error("No se puede eliminar una clase que ya tiene reservas.");
    }
    await client.query('DELETE FROM classes WHERE id = $1', [classId]);
    await client.query('COMMIT');
    return true;
  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getTeacherStats(year: number, month: number): Promise<Record<string, number>> {
    try {
        const result = await pool.query(
            `SELECT teacher, COUNT(*) as class_count
            FROM classes
            WHERE teacher IS NOT NULL AND EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
            GROUP BY teacher`,
            [year, month + 1] // DB month is 1-12
        );
        
        const stats: Record<string, number> = {};
        result.rows.forEach(row => {
            stats[row.teacher] = parseInt(row.class_count, 10);
        });
        return stats;
    } catch(error) {
        console.error("Could not fetch teacher stats. Please run DB setup script.", error);
        return {};
    }
}


// Custom Pack Price Management
export async function getCustomPackPrices(): Promise<Record<string, number>> {
    try {
        const result = await pool.query('SELECT * FROM custom_pack_prices ORDER BY num_classes ASC');
        const prices: Record<string, number> = {};
        result.rows.forEach(row => {
            prices[row.num_classes.toString()] = parseFloat(row.price);
        });
        return prices;
    } catch (error) {
        console.error("Could not fetch custom pack prices. Please run DB setup script.", error);
        return {};
    }
}

export async function updateCustomPackPrices(prices: Record<string, number>): Promise<Record<string, number>> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updatePromises = Object.entries(prices).map(([numClasses, price]) => {
          const num = parseInt(numClasses, 10);
          if (isNaN(num) || num < 1 || num > 12) return null; // Skip invalid
            return client.query(
                `INSERT INTO custom_pack_prices (num_classes, price) VALUES ($1, $2)
                 ON CONFLICT (num_classes) DO UPDATE SET price = $2`,
                [num, price]
            )
        }).filter(Boolean);
        await Promise.all(updatePromises);
        await client.query('COMMIT');
        return await getCustomPackPrices();
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// Pack Management
export async function getClassPacks(): Promise<ClassPack[]> {
    try {
        const result = await pool.query('SELECT * FROM class_packs ORDER BY classes ASC');
        return result.rows.map(row => ({
            ...row,
            classes: parseInt(row.classes, 10),
            price: parseFloat(row.price),
        }));
    } catch (error) {
        console.error("Could not fetch class packs. Please run DB setup script.", error);
        return [];
    }
}

export async function addClassPack(packData: Omit<ClassPack, 'id'>): Promise<ClassPack> {
    const { name, classes, price } = packData;
    const newId = classes.toString();
    const result = await pool.query(
        'INSERT INTO class_packs (id, name, classes, price) VALUES ($1, $2, $3, $4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price RETURNING *',
        [newId, name, classes, price]
    );
    const row = result.rows[0];
    return { ...row, classes: parseInt(row.classes), price: parseFloat(row.price) };
}

export async function updateClassPack(packData: ClassPack): Promise<ClassPack> {
    const { id, name, classes, price } = packData;
    const newId = classes.toString();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (id !== newId) {
            await client.query('DELETE FROM class_packs WHERE id = $1', [id]);
            await client.query('INSERT INTO class_packs (id, name, classes, price) VALUES ($1, $2, $3, $4)', [newId, name, classes, price]);
        } else {
             await client.query('UPDATE class_packs SET name = $1, price = $2 WHERE id = $3', [name, price, id]);
        }
        await client.query('COMMIT');
        const finalResult = await pool.query('SELECT * FROM class_packs WHERE id = $1', [newId]);
        const row = finalResult.rows[0];
        return { id: row.id, name: row.name, classes: parseInt(row.classes), price: parseFloat(row.price) };
    } catch(e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function deleteClassPack(packId: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM class_packs WHERE id = $1', [packId]);
    return result.rowCount > 0;
}
