"use client"

import React, { useState, useMemo, useEffect } from "react"
import { DayPicker, DayProps } from "react-day-picker"
import { es } from "date-fns/locale"
import { Wind, CalendarDays, Check, List, Trash2, Users, FileText, CheckCircle2, CalendarCheck, Loader2 } from "lucide-react"

import type { AeroClass, Booking } from "@/lib/types"
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
import { createBooking, fetchClasses } from "@/app/actions"

// --- Custom Day Component for Calendar ---
function CustomDay(props: DayProps & {
  allClasses: AeroClass[];
  selectedClasses: AeroClass[];
  onSelectClass: (cls: AeroClass) => void;
  packSize: number | null;
}) {
  const { date, displayMonth, allClasses, onSelectClass, selectedClasses, packSize } = props;
  const dayClasses = allClasses.filter(c => c.date.toDateString() === date.toDateString());

  if (!displayMonth) return <></>;

  const hasClasses = dayClasses.length > 0;
  const isSelectedDay = selectedClasses.some(sc => sc.date.toDateString() === date.toDateString());
  const today = new Date();
  today.setHours(0,0,0,0);
  const isDayInPast = date < today;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[110px] w-full flex-col p-1.5 border-t transition-colors",
        isDayInPast ? "bg-muted/50" : "hover:bg-accent",
        hasClasses && !isDayInPast && "bg-primary/10",
        isSelectedDay && "bg-primary/20 ring-2 ring-primary z-10"
      )}
    >
      <time dateTime={date.toISOString()} className={cn("self-start text-sm", isDayInPast && "text-muted-foreground line-through")}>
        {date.getDate()}
      </time>
      {hasClasses && !isDayInPast && (
        <div className="mt-auto">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-none">
              <AccordionTrigger className="-my-1 p-1 text-xs hover:no-underline justify-center [&[data-state=open]>svg]:hidden [&[data-state=closed]>svg]:hidden">
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/90">
                    {dayClasses.length} {dayClasses.length > 1 ? 'clases' : 'clase'}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-1 pb-1 mt-1">
                {dayClasses.map(cls => {
                  const remaining = cls.totalSpots - cls.bookedSpots;
                  const isFull = remaining <= 0;
                  const isSelected = selectedClasses.some(sc => sc.id === cls.id);
                  const isDisabled = isFull || !packSize;

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
  return (
      <div className="flex flex-col items-center justify-center text-center py-10 sm:py-16">
          <Card className="w-full max-w-2xl p-6 sm:p-8 shadow-lg animate-in fade-in-50 zoom-in-95">
              <CardHeader>
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                  <CardTitle className="text-3xl mt-4">¡Reserva Confirmada!</CardTitle>
                  <CardDescription className="text-lg mt-2 text-balance">
                      Gracias, <span className="font-semibold text-primary">{booking.student.name}</span>. Tu reserva se ha completado con éxito.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <p className="mb-4 text-muted-foreground">Para cualquier duda, puedes contactarnos. No se envían correos de confirmación por el momento.</p>
                  <Separator className="my-6" />
                  <h3 className="font-semibold text-xl mb-4 text-left">Resumen de tu bono de {booking.packSize} clases ({booking.price}€):</h3>
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
              <CardFooter>
                  <Button size="lg" className="w-full text-lg mt-4" onClick={onNewBooking}>
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

  const [packSize, setPackSize] = useState<number | null>(null)
  const [selectedClasses, setSelectedClasses] = useState<AeroClass[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [classes, setClasses] = useState<AeroClass[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    const loadClasses = async () => {
        setIsLoading(true);
        const fetchedClasses = await fetchClasses();
        const classesWithDates = fetchedClasses.map(c => ({...c, date: new Date(c.date)}));
        setClasses(classesWithDates);
        setIsLoading(false);
    }
    loadClasses();
  }, [])

  const handleSelectPack = (value: string) => {
    const newPackSize = parseInt(value, 10)
    setPackSize(newPackSize)
    if (selectedClasses.length > newPackSize) {
        setSelectedClasses(selectedClasses.slice(0, newPackSize))
        toast({
            title: "Selección actualizada",
            description: "Tu selección de clases se ha acortado para ajustarse al nuevo tamaño del pack.",
        })
    }
  }

  const handleSelectClass = (classToSelect: AeroClass) => {
    if (!name || !email || !phone) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Por favor, completa primero tus datos personales." });
        return;
    }
    if (!packSize) {
      toast({ variant: "destructive", title: "¡Uy!", description: "Por favor, selecciona primero un pack de clases." })
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
    if (!packSize) return;

    if (selectedClasses.length !== packSize) {
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

    const result = await createBooking(student, classIds, packSize);

    if (result.success && result.booking) {
        // The booking object in result is not a full Booking object with Date objects
        // We need to deserialize it.
        const deserializedBooking = {
            ...result.booking,
            bookingDate: new Date(result.booking.bookingDate),
            classes: result.booking.classes.map((c: any) => ({...c, date: new Date(c.date)}))
        }
        setLastBooking(deserializedBooking);
        setBookingState('success');
        
        // Refresh classes data for the next booking
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
    setLastBooking(null);
  }

  const remainingSlots = packSize !== null ? packSize - selectedClasses.length : 0;
  const isBookingDisabled = !packSize || !name || !email || !phone || selectedClasses.length !== packSize;

  if (bookingState === 'success' && lastBooking) {
    return <SuccessScreen booking={lastBooking} onNewBooking={handleNewBooking} />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center text-center">
        <Wind className="w-12 h-12 text-primary" />
        <h1 className="font-headline text-4xl font-bold mt-2">Fusionarte</h1>
        <p className="text-muted-foreground mt-1">Selecciona tu pack, elige tus clases y prepárate para volar.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="text-primary"/>Paso 1: Tus Datos</CardTitle>
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
                <CardTitle className="flex items-center gap-2"><Users className="text-primary"/>Paso 2: Elige Tu Bono</CardTitle>
                <CardDescription>Selecciona un bono mensual para empezar a reservar.</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup onValueChange={handleSelectPack} value={packSize?.toString() ?? ''} disabled={bookingState === 'submitting'}>
                    <div className="flex items-center space-x-2 p-4 rounded-md has-[:checked]:bg-accent has-[:checked]:shadow-inner">
                        <RadioGroupItem value="4" id="p4" />
                        <Label htmlFor="p4" className="text-base flex-grow cursor-pointer">4 Clases / mes - 65€</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-4 rounded-md has-[:checked]:bg-accent has-[:checked]:shadow-inner">
                        <RadioGroupItem value="8" id="p8" />
                        <Label htmlFor="p8" className="text-base flex-grow cursor-pointer">8 Clases / mes - 110€</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-4 rounded-md has-[:checked]:bg-accent has-[:checked]:shadow-inner">
                        <RadioGroupItem value="12" id="p12" />
                        <Label htmlFor="p12" className="text-base flex-grow cursor-pointer">12 Clases / mes - 150€</Label>
                    </div>
                </RadioGroup>
              </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarDays className="text-primary"/>Paso 3: Selecciona Clases</CardTitle>
                    <CardDescription>Haz clic en un día para ver y seleccionar las clases disponibles. Necesitas tus datos y un bono para poder seleccionar.</CardDescription>
                </CardHeader>
                <CardContent>
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
                            onDayClick={() => {}}
                            components={{ Day: (props: DayProps) => (
                              <CustomDay 
                                {...props}
                                allClasses={classes}
                                selectedClasses={selectedClasses}
                                onSelectClass={handleSelectClass}
                                packSize={packSize}
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
              <CardTitle className="flex items-center gap-2"><List className="text-primary"/>Paso 4: Confirma tu Reserva</CardTitle>
              {packSize !== null ? (
                  <CardDescription>
                      Has seleccionado <span className="font-bold text-primary">{selectedClasses.length}</span> de <span className="font-bold text-primary">{packSize}</span> clases.
                      {remainingSlots > 0 ? ` Te quedan ${remainingSlots} por seleccionar.` : ' ¡Lista para confirmar!'}
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
                                <div>
                                    <p className="font-semibold">{cls.name} - {cls.date.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                    <p className="text-sm text-muted-foreground">a las {cls.time}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveClass(cls.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-8 w-8" disabled={bookingState === 'submitting'}>
                                    <Trash2 className="h-4 w-4"/>
                                    <span className="sr-only">Quitar</span>
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        <p>Cuando selecciones tus clases, aparecerán aquí.</p>
                    </div>
                )}
            </CardContent>
            {packSize && (
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
                            { isBookingDisabled && remainingSlots > 0 
                                ? `Selecciona ${remainingSlots} clase${remainingSlots > 1 ? 's' : ''} más`
                                : `Confirmar Reserva (${selectedClasses.length})`
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
