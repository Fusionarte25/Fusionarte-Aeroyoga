"use client"

import React, { useState, useMemo, useEffect } from "react"
import { DayPicker, DayProps } from "react-day-picker"
import { es } from "date-fns/locale"
import { Wind, CalendarDays, Check, List, Trash2, Users } from "lucide-react"

import type { AeroClass } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"


// --- Mock Data Generation ---
const schedule = [
  // Martes
  { day: 2, time: "17:00", name: "Aeroyoga Intermedio" },
  { day: 2, time: "18:00", name: "Aeroyoga Principiante" },
  // Miércoles
  { day: 3, time: "08:15", name: "Aeroyoga Principiantes" },
  { day: 3, time: "17:00", name: "Aeroyoga Principiante" },
  { day: 3, time: "18:00", name: "Aeroyoga Intermedio" },
  // Jueves
  { day: 4, time: "17:00", name: "Aeroyoga Mixto" },
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
        const bookedSpots = Math.floor(Math.random() * 11);
        classes.push({
          id: `class-${year}-${monthIndex}-${day}-${scheduledClass.time.replace(':', '')}`,
          name: scheduledClass.name,
          date,
          time: scheduledClass.time,
          totalSpots: 10,
          bookedSpots,
        });
      }
    });
  }
  return classes;
};


// --- Custom Day Component for Calendar ---
function CustomDay(props: DayProps & {
  allClasses: AeroClass[];
  selectedClasses: AeroClass[];
  onSelectClass: (cls: AeroClass) => void;
  packSize: number | null;
}) {
  const { date, displayMonth, allClasses, selectedClasses, onSelectClass, packSize } = props
  const dayClasses = allClasses.filter(c => c.date.toDateString() === date.toDateString())

  if (!displayMonth) return <></>

  const isSelectedDay = selectedClasses.some(sc => sc.date.toDateString() === date.toDateString())

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[100px] w-full flex-col p-1.5",
        isSelectedDay && "bg-accent rounded-md"
      )}
    >
      <time dateTime={date.toISOString()} className="self-start">{date.getDate()}</time>
      {dayClasses.length > 0 && (
         <Accordion type="single" collapsible className="w-full -my-1">
          <AccordionItem value="item-1" className="border-none">
            <AccordionTrigger className="p-1 text-xs hover:no-underline justify-center [&[data-state=open]>svg]:hidden [&[data-state=closed]>svg]:hidden">
              <span className="font-normal">{dayClasses.length} clases</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-1 pb-1">
              {dayClasses.map(cls => {
                const remaining = cls.totalSpots - cls.bookedSpots
                const isFull = remaining <= 0
                const isSelected = selectedClasses.some(sc => sc.id === cls.id)
                const isDisabled = isFull || !packSize
  
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
                        <p>{remaining > 0 ? `${remaining} libres` : "Completo"}</p>
                        {isSelected && <Check className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}


// --- Main Application Component ---
export function AeroClassManager() {
  const [packSize, setPackSize] = useState<number | null>(null)
  const [selectedClasses, setSelectedClasses] = useState<AeroClass[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [classes, setClasses] = useState<AeroClass[]>([])
  const { toast } = useToast()

  useEffect(() => {
    setClasses(generateMockClasses(currentMonth))
  }, [currentMonth])

  const classesByDay = useMemo(() => {
    return classes.reduce((acc, cls) => {
      const day = cls.date.toDateString()
      if (!acc[day]) acc[day] = []
      acc[day].push(cls)
      return acc
    }, {} as Record<string, AeroClass[]>)
  }, [classes])

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
      toast({ variant: "destructive", title: "Límite Alcanzado", description: `Solo puedes seleccionar hasta ${packSize} clases.` })
      return
    }

    setSelectedClasses(prev => [...prev, classToSelect].sort((a,b) => a.date.getTime() - b.date.getTime()))
  }

  const handleRemoveClass = (classId: string) => {
    setSelectedClasses(prev => prev.filter(c => c.id !== classId))
  }
  
  const handleConfirmBooking = () => {
    if (selectedClasses.length === 0) {
        toast({ variant: "destructive", title: "No hay clases seleccionadas", description: "Por favor, selecciona al menos una clase para reservar." })
        return
    }
    // In a real app, this would trigger an API call
    toast({
        title: "¡Reserva Confirmada!",
        description: `Has reservado con éxito ${selectedClasses.length} clases.`,
        action: <Button variant="outline" size="sm">Ver</Button>
    })
    
    // Reset state after booking
    const updatedClasses = classes.map(cls => {
        const selectedVersion = selectedClasses.find(sc => sc.id === cls.id)
        if (selectedVersion) {
            return { ...cls, bookedSpots: cls.bookedSpots + 1 }
        }
        return cls;
    })
    setClasses(updatedClasses)
    setSelectedClasses([])
  }

  const remainingSlots = packSize !== null ? packSize - selectedClasses.length : 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center text-center">
        <Wind className="w-12 h-12 text-primary" />
        <h1 className="font-headline text-4xl font-bold mt-2">Fusionarte</h1>
        <p className="text-muted-foreground mt-1">Selecciona tu pack, elige tus clases y prepárate para volar.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-8 space-y-8 lg:space-y-0">
        <div className="lg:col-span-1 space-y-8">
            {/* --- Pack Selector --- */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="text-primary"/>Elige Tu Plan</CardTitle>
                <CardDescription>Selecciona un pack mensual para empezar a reservar.</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup onValueChange={handleSelectPack} value={packSize?.toString()}>
                    <div className="flex items-center space-x-2 p-4 rounded-md has-[:checked]:bg-accent has-[:checked]:shadow-inner">
                        <RadioGroupItem value="4" id="p4" />
                        <Label htmlFor="p4" className="text-base flex-grow cursor-pointer">4 Clases / mes</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-4 rounded-md has-[:checked]:bg-accent has-[:checked]:shadow-inner">
                        <RadioGroupItem value="8" id="p8" />
                        <Label htmlFor="p8" className="text-base flex-grow cursor-pointer">8 Clases / mes</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-4 rounded-md has-[:checked]:bg-accent has-[:checked]:shadow-inner">
                        <RadioGroupItem value="12" id="p12" />
                        <Label htmlFor="p12" className="text-base flex-grow cursor-pointer">12 Clases / mes</Label>
                    </div>
                </RadioGroup>
              </CardContent>
            </Card>
            
            {/* --- Selected Classes --- */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><List className="text-primary"/>Tus Selecciones</CardTitle>
                  {packSize !== null && (
                      <CardDescription>
                          Puedes reservar <span className="font-bold text-primary">{remainingSlots}</span> clases más.
                      </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                    {selectedClasses.length > 0 ? (
                        <ul className="space-y-3">
                           {selectedClasses.map(cls => (
                               <li key={cls.id} className="flex items-center justify-between bg-secondary p-3 rounded-lg animate-in fade-in-20">
                                   <div>
                                       <p className="font-semibold">{cls.date.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                       <p className="text-sm text-muted-foreground">a las {cls.time}</p>
                                   </div>
                                   <Button variant="ghost" size="icon" onClick={() => handleRemoveClass(cls.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-8 w-8">
                                       <Trash2 className="h-4 w-4"/>
                                       <span className="sr-only">Quitar</span>
                                   </Button>
                               </li>
                           ))}
                        </ul>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            <p>Tus clases seleccionadas aparecerán aquí.</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button 
                        size="lg" 
                        className="w-full text-lg" 
                        onClick={handleConfirmBooking}
                        disabled={selectedClasses.length === 0}
                    >
                        <Check className="mr-2 h-5 w-5"/>
                        Confirmar Reserva ({selectedClasses.length})
                    </Button>
                </CardFooter>
            </Card>
        </div>

        {/* --- Calendar View --- */}
        <div className="lg:col-span-2">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarDays className="text-primary"/>Clases Disponibles</CardTitle>
                    <CardDescription>Haz clic en un día para ver y seleccionar las clases disponibles.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Calendar
                        locale={es}
                        mode="single"
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
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
                    />
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}
