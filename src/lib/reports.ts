import { jsPDF } from "jspdf";
import type { Medicine, DoseLog, Appointment, Vital, Settings } from "./mediguardian";

export function generateAdherenceReportPDF({
  patientName,
  settings,
  medicines,
  logs,
  appointments,
  vitals,
  days = 7,
}: {
  patientName: string;
  settings: Settings;
  medicines: Medicine[];
  logs: Record<string, DoseLog>;
  appointments: Appointment[];
  vitals: Vital[];
  days?: number;
}): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header background
  doc.setFillColor(34, 139, 102); // CuraCare mint-emerald
  doc.rect(0, 0, pageWidth, 28, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("CuraCare — Medication Adherence Report", 14, 18);

  // Subtitle info
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const nowStr = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`Patient: ${patientName}`, 14, 38);
  doc.text(`Generated: ${nowStr} (${days}-Day Summary)`, 14, 44);
  doc.text(`Primary Caregiver: ${settings.caregiverName || "None assigned"} (${settings.caregiverPhone || "N/A"})`, 14, 50);

  // Divider
  doc.setDrawColor(200, 220, 210);
  doc.line(14, 54, pageWidth - 14, 54);

  // Summary statistics
  const logEntries = Object.values(logs);
  const takenCount = logEntries.filter((l) => l.status === "taken").length;
  const skippedCount = logEntries.filter((l) => l.status === "skipped").length;
  const totalLogged = takenCount + skippedCount;
  const adherenceRate = totalLogged ? Math.round((takenCount / totalLogged) * 100) : 100;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Adherence Summary", 14, 64);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total Doses Logged: ${totalLogged}`, 14, 72);
  doc.text(`Taken On-Time: ${takenCount}`, 70, 72);
  doc.text(`Skipped/Missed: ${skippedCount}`, 130, 72);
  doc.text(`Overall Adherence: ${adherenceRate}%`, 14, 78);

  // Active Prescriptions Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Current Prescription Schedule", 14, 92);

  let y = 100;
  doc.setFillColor(240, 248, 244);
  doc.rect(14, y - 5, pageWidth - 28, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Medicine", 16, y);
  doc.text("Dosage", 65, y);
  doc.text("Schedule", 105, y);
  doc.text("Instructions", 145, y);
  doc.text("Stock Left", 175, y);

  doc.setFont("helvetica", "normal");
  y += 7;

  medicines.forEach((m) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(m.name, 16, y);
    doc.text(m.dosage, 65, y);
    doc.text(m.times.join(", "), 105, y);
    doc.text(m.food, 145, y);
    doc.text(`${m.quantity} units`, 175, y);
    y += 7;
  });

  // Recent Vital Signs
  if (vitals.length > 0) {
    y += 6;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Recent Health Vitals", 14, y);
    y += 8;

    doc.setFillColor(240, 248, 244);
    doc.rect(14, y - 5, pageWidth - 28, 8, "F");
    doc.setFontSize(9);
    doc.text("Date", 16, y);
    doc.text("Blood Pressure", 50, y);
    doc.text("Blood Sugar", 90, y);
    doc.text("Pulse", 130, y);
    doc.text("Weight", 160, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    vitals.slice(0, 5).forEach((v) => {
      doc.text(v.date || "-", 16, y);
      doc.text(v.bp || "-", 50, y);
      doc.text(v.sugar ? `${v.sugar} mg/dL` : "-", 90, y);
      doc.text(v.pulse ? `${v.pulse} bpm` : "-", 130, y);
      doc.text(v.weight ? `${v.weight} kg` : "-", 160, y);
      y += 7;
    });
  }

  // Upcoming Appointments
  if (appointments.length > 0) {
    y += 6;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Upcoming Doctor Appointments", 14, y);
    y += 8;

    appointments.forEach((a) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`• ${a.doctor} (${a.department || "General"}) — ${a.hospital || "Clinic"} on ${a.date} at ${a.time}`, 16, y);
      y += 6;
    });
  }

  // Footer Disclaimer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Disclaimer: CuraCare is a digital adherence assistant. Please consult your physician for medical decisions.",
    14,
    285
  );

  // Save the PDF
  const filename = `CuraCare-Adherence-Report-${patientName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
