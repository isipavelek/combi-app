export const getOrderedWeekDays = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentHour = now.getHours();

  let startDate = new Date(now);

  // Logic to determine start date
  if (currentDay === 0) {
    // Sunday -> Start Monday
    startDate.setDate(now.getDate() + 1);
  } else if (currentDay === 6) {
    // Saturday -> Start Monday
    startDate.setDate(now.getDate() + 2);
  } else {
    // Mon-Fri
    if (currentHour >= 18) {
      // After 18:00 -> Start Tomorrow
      startDate.setDate(now.getDate() + 1);
      // If tomorrow is Saturday, skip to Monday
      if (startDate.getDay() === 6) {
        startDate.setDate(startDate.getDate() + 2);
      }
    }
    // Else (Before 18:00) -> Start Today (already set)
  }

  const days = [];
  let count = 0;
  let iterDate = new Date(startDate);

  const DAYS_MAP = {
    0: "Domingo",
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado"
  };

  while (count < 5) {
    const dayIndex = iterDate.getDay();
    
    // Skip Saturday (6) and Sunday (0)
    if (dayIndex !== 0 && dayIndex !== 6) {
      const dayName = DAYS_MAP[dayIndex];
      const formattedDate = iterDate.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      days.push({
        name: dayName,
        date: formattedDate,
        key: dayName // This matches the key used in Firestore (e.g., "Lunes")
      });
      count++;
    }
    
    // Move to next day
    iterDate.setDate(iterDate.getDate() + 1);
  }

  return days;
};
