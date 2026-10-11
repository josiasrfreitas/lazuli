import type { AttendanceLocation } from "@lazuli/validators";
export function currentAttendanceLocation(): Promise<AttendanceLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error(
          "Este navegador não disponibiliza localização. Peça ao professor para registrar sua presença.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        }),
      () =>
        reject(
          new Error(
            "Não conseguimos obter sua localização. Permita o acesso e tente novamente, ou peça o registro manual ao professor.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
export function attendanceTime(value: Date): string {
  return value.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}
