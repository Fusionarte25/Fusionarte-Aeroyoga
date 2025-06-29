"use client"

import React, { useState, useMemo, useEffect } from "react"
import { DayPicker, DayProps } from "react-day-picker"
import { es } from "date-fns/locale"
import { Wind, CalendarDays, Check, List, Trash2, Users, FileText, CheckCircle2, CalendarCheck, Loader2, Download, Clock } from "lucide-react"
import { jsPDF } from "jspdf"

import type { AeroClass, Booking, ClassPack } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBooking, fetchClasses, getActiveBookingMonth, fetchPacks, getCustomPackPrices } from "@/app/actions"

// --- Custom Day Component for Calendar ---
function CustomDay(props: DayProps & {
  allClasses: AeroClass[];
  selectedClasses: AeroClass[];
  onSelectClass: (cls: AeroClass) => void;
  packType: ClassPack['type'] | null;
  activeBookingMonth: Date | null;
}) {
  const { date, displayMonth, allClasses, onSelectClass, selectedClasses, packType, activeBookingMonth } = props;
  const dayClasses = allClasses.filter(c => c.date.toDateString() === date.toDateString());

  if (!displayMonth) return <></>;

  const hasClasses = dayClasses.length > 0;
  const isSelectedDay = selectedClasses.some(sc => sc.date.toDateString() === date.toDateString());
  const today = new Date();
  today.setHours(0,0,0,0);
  const isDayInPast = date < today;

  const isBookableMonth = activeBookingMonth && date.getFullYear() === activeBookingMonth.getFullYear() && date.getMonth() === activeBookingMonth.getMonth();
  const isCalendarDisabled = packType === 'fixed_monthly';

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[90px] sm:min-h-[110px] w-full flex-col p-1.5 border-t transition-colors",
        isDayInPast || isCalendarDisabled ? "bg-muted/50" : "hover:bg-accent",
        hasClasses && !isDayInPast && !isBookableMonth && "bg-amber-100/50 dark:bg-amber-900/30",
        hasClasses && !isDayInPast && isBookableMonth && !isCalendarDisabled && "bg-primary/10",
        isSelectedDay && "bg-primary/20 ring-2 ring-primary z-10"
      )}
    >
      <time dateTime={date.toISOString()} className={cn("self-start text-sm", (isDayInPast || !isBookableMonth || isCalendarDisabled) && "text-muted-foreground", isDayInPast && "line-through")}>
        {date.getDate()}
      </time>
      {hasClasses && !isDayInPast && (
        <div className="mt-auto">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-none">
              <AccordionTrigger className="-my-1 p-1 text-xs hover:no-underline justify-center [&[data-state=open]>svg]:hidden [&[data-state=closed]>svg]:hidden">
                <div className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isBookableMonth && !isCalendarDisabled
                        ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "border-transparent bg-amber-300 text-amber-900 dark:bg-amber-800 dark:text-amber-100 cursor-not-allowed"
                )}>
                    Clases
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-1 pb-1 mt-1">
                {dayClasses.map(cls => {
                  const remaining = cls.totalSpots - cls.bookedSpots;
                  const isFull = remaining <= 0;
                  const isSelected = selectedClasses.some(sc => sc.id === cls.id);
                  const isDisabled = isFull || !isBookableMonth || isCalendarDisabled;

                  return (
                    <button
                      key={cls.id}
                      disabled={isDisabled}
                      onClick={() => onSelectClass(cls)}
                      className={cn(
                        "w-full text-left p-1.5 rounded-md text-xs transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-primary/10",
                        isDisabled && "opacity-50 cursor-not-allowed bg-secondary"
                      )}
                    >
                      <p className="font-semibold">{cls.name}</p>
                      <div className="flex justify-between items-center">
                        <p>{cls.time}</p>
                        <div className="flex items-center gap-1">
                          <p>{isFull ? "Completo" : `${remaining} libres`}</p>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}

// --- Success Screen Component ---
function SuccessScreen({ booking, onNewBooking }: { booking: Booking; onNewBooking: () => void }) {
  const handleDownloadReceipt = () => {
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Resumen de Reserva - Fusionarte", 105, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Gracias por tu reserva, ${booking.student.name}.`, 10, 40);

    doc.line(10, 45, 200, 45);

    doc.setFont("helvetica", "bold");
    doc.text("Detalles de la Reserva", 10, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`ID de Reserva: ${booking.id}`, 10, 65);
    doc.text(`Fecha de Reserva: ${new Date(booking.bookingDate).toLocaleString('es-ES')}`, 10, 72);
    doc.text(`Bono: ${booking.packSize} clases`, 10, 79);
    doc.text(`Precio Total: ${booking.price}€`, 10, 86);

    doc.line(10, 96, 200, 96);
    
    doc.setFont("helvetica", "bold");
    doc.text("Clases Seleccionadas", 10, 106);
    doc.setFont("helvetica", "normal");
    
    let yPos = 116;
    booking.classes.forEach(cls => {
      const classLine = `· ${cls.name} - ${new Date(cls.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${cls.time}`;
      doc.text(classLine, 15, yPos);
      yPos += 7;
    });

    doc.line(10, yPos + 5, 200, yPos + 5);
    
    doc.setFontSize(10);
    doc.text("Para cualquier duda, puedes contactarnos. ¡Nos vemos en clase!", 105, yPos + 15, { align: "center" });

    doc.save(`comprobante-fusionarte-${booking.student.name.replace(/\s/g, '_')}.pdf`);
  };

  return (
      <div className="flex flex-col items-center justify-center text-center py-10 sm:py-16">
          <Card className="w-full max-w-2xl p-4 sm:p-6 md:p-8 shadow-lg animate-in fade-in-50 zoom-in-95">
              <CardHeader>
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                  <CardTitle className="text-2xl sm:text-3xl mt-4">¡Reserva Confirmada!</CardTitle>
                  <CardDescription className="text-base sm:text-lg mt-2 text-balance">
                      Gracias, <span className="font-semibold text-primary">{booking.student.name}</span>. Tu reserva se ha completado con éxito.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <p className="mb-4 text-muted-foreground">Hemos generado un comprobante en PDF para ti. Para cualquier duda, puedes contactarnos.</p>
                  <Separator className="my-6" />
                  <h3 className="font-semibold text-lg sm:text-xl mb-4 text-left">Resumen de tu bono de {booking.packSize} clases ({booking.price}€):</h3>
                  <ul className="space-y-3 text-left">
                      {booking.classes.map((cls: AeroClass) => (
                          <li key={cls.id} className="flex items-center justify-between bg-secondary p-3 rounded-lg">
                              <div>
                                  <p className="font-semibold">{cls.name} - {new Date(cls.date).toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                  <p className="text-sm text-muted-foreground">a las {cls.time} con {cls.teacher}</p>
                              </div>
                              <CalendarCheck className="h-5 w-5 text-primary"/>
                          </li>
                      ))}
                  </ul>
              </CardContent>
              <CardFooter className="flex-col sm:flex-row gap-4 mt-4">
                  <Button size="lg" className="w-full text-base sm:text-lg" onClick={handleDownloadReceipt} variant="outline">
                      <Download className="mr-2 h-5 w-5"/> Descargar Comprobante PDF
                  </Button>
                  <Button size="lg" className="w-full text-base sm:text-lg" onClick={onNewBooking}>
                      Hacer una nueva reserva
                  </Button>
              </CardFooter>
          </Card>
      </div>
  );
}


// --- Main Application Component ---
export function AeroClassManager() {
  const [bookingState, setBookingState] = useState<'form' | 'submitting' | 'success'>('form');
  const [lastBooking, setLastBooking] = useState<Booking | null>(null);

  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [selectedPackType, setSelectedPackType] = useState<ClassPack['type'] | null>(null);
  const [packSize, setPackSize] = useState<number | null>(null);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [customPackSelection, setCustomPackSelection] = useState<string>("");
  const [customPackPrices, setCustomPackPrices] = useState<Record<string, number> | null>(null);
  const [selectedFixedSchedule, setSelectedFixedSchedule] = useState<string>("");

  const [selectedClasses, setSelectedClasses] = useState<AeroClass[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [classes, setClasses] = useState<AeroClass[]>([])
  const [classPacks, setClassPacks] = useState<ClassPack[]>([]);
  const [isLoading, setIsLoading] = useState(true)
  const [activeBookingMonth, setActiveBookingMonth] = useState<Date | null>(null);
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const [fetchedClasses, fetchedMonth, fetchedPacks, fetchedCustomPrices] = await Promise.all([
                fetchClasses(),
                getActiveBookingMonth(),
                fetchPacks(),
                getCustomPackPrices(),
            ]);
            const classesWithDates = fetchedClasses.map(c => ({...c, date: new Date(c.date)}));
            setClasses(classesWithDates);
            setClassPacks(fetchedPacks);
            setCustomPackPrices(fetchedCustomPrices);
            
            const activeMonthDate = fetchedMonth ? new Date(fetchedMonth) : null;
            setActiveBookingMonth(activeMonthDate);
            if (activeMonthDate) {
              setCurrentMonth(new Date(activeMonthDate));
            } else {
              setCurrentMonth(new Date());
            }
        } catch (error) {
            console.error("Failed to load initial data", error);
            toast({
                variant: "destructive",
                title: "Error al cargar",
                description: "No se pudieron cargar los datos de las clases. Refresca la página."
            });
        } finally {
            setIsLoading(false);
        }
    }
    loadInitialData();
  }, [toast])

  const handlePackSelectionChange = (value: string) => {
    setSelectedPackId(value);
    setCustomPackSelection("");
    setSelectedFixedSchedule("");
    setSelectedClasses([]);

    const selectedPack = classPacks.find(p => p.id === value);
    if (selectedPack) {
      setSelectedPackType(selectedPack.type);
      if (selectedPack.type === 'standard') {
        const standardPack = classPacks.find(p => p.id === value);
        if (standardPack) {
            setPackSize(standardPack.classes);
            setTotalPrice(standardPack.price);
        }
      } else if (selectedPack.type === 'fixed_monthly') {
          setPackSize(null);
          setTotalPrice(selectedPack.price);
      }
    } else if (value === 'custom') {
        setSelectedPackType('standard');
        setPackSize(null);
        setTotalPrice(null);
    }
  }
  
  const handleCustomPackSelection = (value: string) => {
      setCustomPackSelection(value);
      if (selectedPackId === 'custom' && customPackPrices) {
          const newCount = parseInt(value, 10);
          if (!isNaN(newCount) && newCount > 0) {
              setPackSize(newCount);
              setTotalPrice(customPackPrices[value]);
          } else {
              setPackSize(null);
              setTotalPrice(null);
          }
      }
  }

  const availableFixedSchedules = useMemo(() => {
    if (!activeBookingMonth || classes.length === 0) return [];
    
    const monthClasses = classes.filter(c => {
        const d = new Date(c.date);
        return d.getFullYear() === activeBookingMonth.getFullYear() && d.getMonth() === activeBookingMonth.getMonth();
    });

    const schedules = new Map<string, AeroClass[]>();
    const weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    monthClasses.forEach(c => {
        const dayOfWeek = weekdays[c.date.getDay()];
        const key = `${c.name}|${dayOfWeek}|${c.time}|${c.teacher}`;
        if (!schedules.has(key)) schedules.set(key, []);
        schedules.get(key)!.push(c);
    });

    const scheduleOptions: { id: string, label: string, classes: AeroClass[] }[] = [];
    schedules.forEach((classList, key) => {
        const allAvailable = classList.every(c => c.totalSpots - c.bookedSpots > 0);
        if (classList.length > 1 && allAvailable) {
            const [name, day, time, teacher] = key.split('|');
            scheduleOptions.push({
                id: key,
                label: `${name} - ${day} ${time} (con ${teacher}) - ${classList.length} clases`,
                classes: classList,
            });
        }
    });

    return scheduleOptions;
  }, [classes, activeBookingMonth]);

  const handleFixedScheduleChange = (scheduleId: string) => {
      setSelectedFixedSchedule(scheduleId);
      const schedule = availableFixedSchedules.find(s => s.id === scheduleId);
      if (schedule) {
          setSelectedClasses(schedule.classes.sort((a,b) => a.date.getTime() - b.date.getTime()));
          setPackSize(schedule.classes.length);
      } else {
          setSelectedClasses([]);
          setPackSize(null);
      }
  };


  useEffect(() => {
    if (packSize !== null && selectedPackType === 'standard' && selectedClasses.length > packSize) {
        setSelectedClasses(selectedClasses.slice(0, packSize));
        toast({
            title: "Selección actualizada",
            description: "Tu selección de clases se ha acortado para ajustarse al nuevo tamaño del bono.",
        });
    }
  }, [packSize, selectedClasses, selectedPackType, toast]);

  const handleSelectClass = (classToSelect: AeroClass) => {
    if (!name || !email || !phone) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor, completa primero tus datos personales." });
        return;
    }
    if (!packSize) {
      toast({ variant: "destructive", title: "¡Uy!", description: "Por favor, selecciona primero un bono de clases." })
      return
    }
    const isSelected = selectedClasses.some(c => c.id === classToSelect.id)

    if (isSelected) {
      handleRemoveClass(classToSelect.id)
      return
    }

    if (selectedClasses.length >= packSize) {
      toast({ variant: "destructive", title: "Límite Alcanzado", description: `Ya has seleccionado ${packSize} clases para tu bono.` })
      return
    }

    setSelectedClasses(prev => [...prev, classToSelect].sort((a,b) => a.date.getTime() - b.date.getTime()))
  }

  const handleRemoveClass = (classId: string) => {
    setSelectedClasses(prev => prev.filter(c => c.id !== classId))
  }
  
  const handleConfirmBooking = async () => {
    if (!packSize || !totalPrice) return;

    if (selectedClasses.length === 0) {
      toast({ variant: "destructive", title: "Sin clases", description: "Debes seleccionar tus clases para continuar." });
      return;
    }

    if (selectedPackType === 'standard' && selectedClasses.length !== packSize) {
        toast({ variant: "destructive", title: "Clases insuficientes", description: `Debes seleccionar exactamente ${packSize} clases para tu bono.` })
        return
    }
    if (!name || !email || !phone) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor, completa tu nombre, email y teléfono para continuar." });
        return;
    }

    setBookingState('submitting');

    const student = { name, email, phone };
    const classIds = selectedClasses.map(c => ({ id: c.id }));

    const result = await createBooking(student, classIds, packSize, totalPrice);

    if (result.success && result.booking) {
        const deserializedBooking = {
            ...result.booking,
            bookingDate: new Date(result.booking.bookingDate),
            classes: result.booking.classes.map((c: any) => ({...c, date: new Date(c.date)}))
        }
        setLastBooking(deserializedBooking);
        setBookingState('success');
        
        const fetchedClasses = await fetchClasses();
        const classesWithDates = fetchedClasses.map(c => ({...c, date: new Date(c.date)}));
        setClasses(classesWithDates);
    } else {
        toast({
            variant: "destructive",
            title: "Error en la reserva",
            description: result.error || "No se pudo completar la reserva. Inténtalo de nuevo."
        });
        setBookingState('form');
    }
  }

  const handleNewBooking = () => {
    setBookingState('form');
    setSelectedClasses([]);
    setName("");
    setEmail("");
    setPhone("");
    setPackSize(null);
    setSelectedPackId(null);
    setSelectedPackType(null);
    setTotalPrice(null);
    setCustomPackSelection("");
    setSelectedFixedSchedule("");
    setLastBooking(null);
  }

  const remainingSlots = packSize !== null ? packSize - selectedClasses.length : 0;
  
  const isBookingDisabled = !packSize || !name || !email || !phone || selectedClasses.length === 0 ||
    (selectedPackType === 'standard' && selectedClasses.length !== packSize);


  if (bookingState === 'success' && lastBooking) {
    return <SuccessScreen booking={lastBooking} onNewBooking={handleNewBooking} />
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-col items-center text-center">
        <Wind className="w-12 h-12 text-primary" />
        <h1 className="font-headline text-3xl sm:text-4xl font-bold mt-2">Fusionarte</h1>
        <p className="text-muted-foreground mt-1 max-w-prose">Selecciona tu pack, elige tus clases y prepárate para volar.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><FileText className="text-primary"/>Paso 1: Tus Datos</CardTitle>
                    <CardDescription>Completa tus datos para la reserva.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre y Apellido</Label>
                        <Input id="name" placeholder="Tu nombre completo" value={name} onChange={(e) => setName(e.target.value)} disabled={bookingState === 'submitting'} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={bookingState === 'submitting'} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input id="phone" type="tel" placeholder="600 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={bookingState === 'submitting'} />
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><Users className="text-primary"/>Paso 2: Elige Tu Bono</CardTitle>
                <CardDescription>Selecciona un bono mensual o crea uno personalizado.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-40 w-full" /> : (
                  <RadioGroup onValueChange={handlePackSelectionChange} value={selectedPackId ?? ''} disabled={bookingState === 'submitting'} className="gap-1">
                      {classPacks.map(pack => (
                          <div key={pack.id} className="flex items-center space-x-2 p-3 sm:p-4 rounded-md has-[:checked]:bg-accent has-[:checked]:shadow-inner">
                              <RadioGroupItem value={pack.id} id={`p${pack.id}`} />
                              <Label htmlFor={`p${pack.id}`} className="text-sm sm:text-base flex-grow cursor-pointer">{pack.name} - {pack.price}€</Label>
                          </div>
                      ))}
                      <div className="flex items-center space-x-2 p-3 sm:p-4 rounded-md has-[:checked]:bg-accent has-[:checked]:shadow-inner">
                          <RadioGroupItem value="custom" id="p-custom" />
                          <Label htmlFor="p-custom" className="text-sm sm:text-base flex-grow cursor-pointer">Bono Personalizado</Label>
                      </div>
                      {selectedPackId === 'custom' && (
                          <div className="pl-8 pt-2 space-y-2 animate-in fade-in-50">
                              <Label>Número de clases</Label>
                              <Select value={customPackSelection} onValueChange={handleCustomPackSelection} disabled={bookingState === 'submitting'}>
                                  <SelectTrigger className="w-full sm:max-w-[220px]"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                                  <SelectContent>
                                      {customPackPrices && Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                                          <SelectItem key={num} value={num.toString()} disabled={!customPackPrices[num.toString()]}>
                                              {num} {num > 1 ? 'clases' : 'clase'} - {customPackPrices[num.toString()]}€
                                          </SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                      )}
                  </RadioGroup>
                )}
              </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><CalendarDays className="text-primary"/>Paso 3: Selecciona Clases</CardTitle>
                     {activeBookingMonth ? (
                        <CardDescription>
                            Mes de inscripción: <span className="font-semibold text-primary">{activeBookingMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>.
                            {selectedPackType !== 'fixed_monthly' && " Puedes navegar por el calendario, pero solo puedes reservar en el mes activo."}
                        </CardDescription>
                    ) : (
                         <CardDescription>
                            <span className="font-semibold text-destructive">Las inscripciones están cerradas actualmente.</span>
                            Puedes navegar por el calendario para ver los horarios.
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent>
                    {selectedPackType === 'fixed_monthly' && (
                        <div className="p-4 mb-4 bg-primary/10 border-l-4 border-primary rounded-r-lg">
                             <Label className="flex items-center gap-2 font-semibold mb-2"><Clock className="h-4 w-4"/>Elige tu horario fijo para el mes</Label>
                             <Select value={selectedFixedSchedule} onValueChange={handleFixedScheduleChange} disabled={!activeBookingMonth || bookingState === 'submitting'}>
                                <SelectTrigger><SelectValue placeholder="Selecciona un horario recurrente" /></SelectTrigger>
                                <SelectContent>
                                    {availableFixedSchedules.length > 0 ? (
                                        availableFixedSchedules.map(schedule => (
                                            <SelectItem key={schedule.id} value={schedule.id}>{schedule.label}</SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="none" disabled>No hay horarios fijos disponibles</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {isLoading ? (
                         <div className="flex justify-center items-center min-h-[300px]">
                            <Skeleton className="h-[450px] w-full" />
                         </div>
                    ) : (
                        <Calendar
                            locale={es}
                            mode="single"
                            month={currentMonth}
                            onMonthChange={setCurrentMonth}
                            fromMonth={new Date(new Date().getFullYear(), new Date().getMonth() -1, 1)}
                            onDayClick={() => {}}
                            components={{ Day: (props: DayProps) => (
                              <CustomDay 
                                {...props}
                                allClasses={classes}
                                selectedClasses={selectedClasses}
                                onSelectClass={handleSelectClass}
                                packType={selectedPackType}
                                activeBookingMonth={activeBookingMonth}
                              />
                            )}}
                            className="p-0"
                            classNames={{
                              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                              month: "space-y-4 w-full",
                              head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
                              row: "flex w-full mt-2",
                              cell: "w-full text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                              day: "w-full h-full",
                              caption_label: "text-lg font-bold",
                            }}
                            disabled={bookingState === 'submitting'}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
      </div>

      <div className="mt-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl"><List className="text-primary"/>Paso 4: Confirma tu Reserva</CardTitle>
              {packSize !== null ? (
                  <CardDescription>
                      Has seleccionado <span className="font-bold text-primary">{selectedClasses.length}</span> de <span className="font-bold text-primary">{packSize}</span> clases.
                      {selectedPackType === 'standard' && remainingSlots > 0 && ` Te quedan ${remainingSlots} por seleccionar.`}
                      {(selectedPackType !== 'standard' || remainingSlots === 0) && ' ¡Lista para confirmar!'}
                      {totalPrice !== null && <span className="block mt-1">Precio total: <span className="font-bold text-primary">{totalPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></span>}
                  </CardDescription>
              ) : (
                <CardDescription>Selecciona un bono y tus clases para ver aquí el resumen.</CardDescription>
              )}
            </CardHeader>
            <CardContent>
                {selectedClasses.length > 0 ? (
                    <ul className="space-y-3">
                        {selectedClasses.map(cls => (
                            <li key={cls.id} className="flex items-center justify-between bg-secondary p-3 rounded-lg animate-in fade-in-20">
                                <div className="pr-4">
                                    <p className="font-semibold">{cls.name} - {cls.date.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                    <p className="text-sm text-muted-foreground">a las {cls.time}</p>
                                </div>
                                {selectedPackType !== 'fixed_monthly' && (
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveClass(cls.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-8 w-8 flex-shrink-0" disabled={bookingState === 'submitting'}>
                                        <Trash2 className="h-4 w-4"/>
                                        <span className="sr-only">Quitar</span>
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        <p>Cuando selecciones tus clases, aparecerán aquí.</p>
                    </div>
                )}
            </CardContent>
            {(selectedPackId) && (
                <CardFooter>
                    <Button 
                        size="lg" 
                        className="w-full text-lg" 
                        onClick={handleConfirmBooking}
                        disabled={isBookingDisabled || bookingState === 'submitting'}
                    >
                        {bookingState === 'submitting' ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Confirmando...</>
                        ) : (
                            <><Check className="mr-2 h-5 w-5"/>
                            { isBookingDisabled && selectedPackType === 'standard' && remainingSlots > 0 
                                ? `Selecciona ${remainingSlots} clase${remainingSlots > 1 ? 's' : ''} más`
                                : `Confirmar Reserva (${selectedClasses.length} ${selectedClasses.length > 1 ? 'clases' : 'clase'})`
                            }</>
                        )}
                    </Button>
                </CardFooter>
            )}
        </Card>
      </div>
    </div>
  )
}
