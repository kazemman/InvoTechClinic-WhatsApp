import { 
  users, patients, appointments, checkIns, queue, consultations, payments, activityLogs, medicalAttachments, medicalAidClaims, birthdayWishes, appointmentReminders, apiKeys,
  type User, type InsertUser, type Patient, type InsertPatient, 
  type Appointment, type InsertAppointment, type CheckIn, type InsertCheckIn,
  type Queue, type InsertQueue, type Consultation, type InsertConsultation,
  type Payment, type InsertPayment, type ActivityLog, type InsertActivityLog,
  type MedicalAttachment, type InsertMedicalAttachment, type MedicalAidClaim, type InsertMedicalAidClaim,
  type BirthdayWish, type InsertBirthdayWish, type AppointmentReminder, type InsertAppointmentReminder,
  type ApiKey, type InsertApiKey
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, lt, sql, isNotNull, asc, inArray } from "drizzle-orm";

export interface IStorage {
  // Appointment reminder methods
  insertAppointmentReminder(reminder: InsertAppointmentReminder): Promise<AppointmentReminder>;
  getAppointmentReminderByAppointmentAndType(appointmentId: string, reminderType: 'weekly' | 'daily'): Promise<AppointmentReminder | undefined>;
  updateAppointmentReminderResponse(requestId: string, response: string): Promise<void>;
  getAppointmentReminderStatuses(appointmentIds: string[]): Promise<{appointmentId: string, weeklyReminder?: AppointmentReminder, dailyReminder?: AppointmentReminder}[]>;
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Patient methods
  getPatient(id: string): Promise<Patient | undefined>;
  getPatientByPhone(phone: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: string, patient: Partial<InsertPatient>): Promise<Patient>;
  searchPatients(query: string): Promise<Patient[]>;
  getAllPatients(): Promise<Patient[]>;

  // Appointment methods
  getAppointment(id: string): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment>;
  getAppointmentsByDate(date: Date): Promise<Appointment[]>;
  getAppointmentsByDoctor(doctorId: string, date?: Date): Promise<Appointment[]>;
  getAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  checkAppointmentConflict(doctorId: string, appointmentDate: Date, excludeId?: string): Promise<boolean>;
  getAppointmentsBetweenDates(startDate: Date, endDate: Date): Promise<any[]>;
  getAppointmentWithDetails(id: string): Promise<any | undefined>;
  getAvailableAppointmentSlots(doctorId: string, date: Date): Promise<string[]>;
  getAvailableAppointmentSlotsForAllDoctors(date: Date): Promise<Array<{doctorId: string, doctorName: string, availableSlots: string[]}>>;

  // Check-in methods
  createCheckIn(checkIn: InsertCheckIn): Promise<CheckIn>;
  getCheckInsByDate(date: Date): Promise<CheckIn[]>;

  // Queue methods
  getQueue(): Promise<Queue[]>;
  addToQueue(queueItem: InsertQueue): Promise<Queue>;
  updateQueueStatus(id: string, status: string, startedAt?: Date, completedAt?: Date): Promise<Queue>;
  removeFromQueue(id: string): Promise<void>;
  getQueueByDoctor(doctorId: string): Promise<Queue[]>;

  // Consultation methods
  getConsultation(id: string): Promise<Consultation | undefined>;
  createConsultation(consultation: InsertConsultation): Promise<Consultation>;
  getConsultationsByPatient(patientId: string): Promise<Consultation[]>;
  getConsultationsByDoctor(doctorId: string): Promise<Consultation[]>;
  deleteConsultation(id: string): Promise<void>;

  // Payment methods
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByDate(date: Date): Promise<Payment[]>;
  getTotalRevenue(startDate: Date, endDate: Date): Promise<number>;

  // Activity log methods
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;

  // Medical attachment methods
  createMedicalAttachment(attachment: InsertMedicalAttachment): Promise<MedicalAttachment>;
  getMedicalAttachmentsByConsultation(consultationId: string): Promise<MedicalAttachment[]>;
  deleteMedicalAttachment(id: string): Promise<void>;
  getMedicalAttachment(id: string): Promise<MedicalAttachment | undefined>;
  deleteMedicalAttachmentsByConsultation(consultationId: string): Promise<void>;

  // Medical aid claim methods
  createMedicalAidClaim(claim: InsertMedicalAidClaim): Promise<MedicalAidClaim>;
  getAllMedicalAidClaims(): Promise<MedicalAidClaim[]>;
  updateMedicalAidClaim(id: string, claim: Partial<InsertMedicalAidClaim>): Promise<MedicalAidClaim>;

  // Dashboard stats
  getDashboardStats(date: Date): Promise<{
    todayAppointments: number;
    queueCount: number;
    todayRevenue: number;
    newPatients: number;
  }>;

  // Monthly comparison stats
  getMonthlyStats(monthsBack: number): Promise<{
    monthlyData: Array<{
      month: string;
      year: number;
      revenue: number;
      appointments: number;
      patients: number;
      completionRate: number;
    }>;
  }>;

  // Patient retention and trends analytics
  getPatientRetentionStats(): Promise<{
    newVsReturning: {
      newPatients: number;
      returningPatients: number;
      totalPatients: number;
      newPatientRate: number;
      returningPatientRate: number;
    };
    registrationTrends: Array<{
      month: string;
      year: number;
      newRegistrations: number;
      returningPatients: number;
    }>;
    retentionRates: {
      thirtyDay: number;
      sixtyDay: number;
      ninetyDay: number;
    };
  }>;

  // Peak hours analysis
  getPeakHoursAnalysis(): Promise<{
    hourlyDistribution: Array<{
      hour: number;
      count: number;
      percentage: number;
    }>;
    dailyDistribution: Array<{
      day: string;
      dayNumber: number;
      count: number;
      percentage: number;
    }>;
    peakHour: {
      hour: number;
      count: number;
      timeLabel: string;
    };
    peakDay: {
      day: string;
      count: number;
    };
  }>;

  // Birthday wishes methods
  createBirthdayWish(wish: InsertBirthdayWish): Promise<BirthdayWish>;
  getBirthdayWishesByDate(date: Date): Promise<BirthdayWish[]>;
  getTodaysBirthdayPatients(): Promise<Patient[]>;
  cleanupOldBirthdayWishes(): Promise<{ deletedCount: number }>;

  // API key methods
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeysByUser(userId: string): Promise<ApiKey[]>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  revokeApiKey(id: string): Promise<void>;
  updateApiKeyLastUsed(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Patient methods
  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient || undefined;
  }

  async getPatientByPhone(phone: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.phone, phone));
    return patient || undefined;
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const [patient] = await db.insert(patients).values(insertPatient).returning();
    return patient;
  }

  async updatePatient(id: string, patient: Partial<InsertPatient>): Promise<Patient> {
    const [updatedPatient] = await db.update(patients).set(patient).where(eq(patients.id, id)).returning();
    return updatedPatient;
  }

  async searchPatients(query: string): Promise<Patient[]> {
    return await db.select().from(patients)
      .where(sql`lower(${patients.firstName}) LIKE lower(${`%${query}%`}) OR lower(${patients.lastName}) LIKE lower(${`%${query}%`}) OR ${patients.phone} LIKE ${`%${query}%`} OR lower(${patients.idNumber}) LIKE lower(${`%${query}%`})`)
      .orderBy(patients.firstName, patients.lastName);
  }

  async getAllPatients(): Promise<Patient[]> {
    return await db.select().from(patients).orderBy(patients.firstName, patients.lastName);
  }

  // Appointment methods
  async getAppointment(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment || undefined;
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const normalizedAppointment = {
      ...insertAppointment,
      appointmentDate: this.normalizeAppointmentDate(insertAppointment.appointmentDate)
    };
    const [appointment] = await db.insert(appointments).values(normalizedAppointment).returning();
    return appointment;
  }

  async updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment> {
    const updateData = appointment.appointmentDate 
      ? { ...appointment, appointmentDate: this.normalizeAppointmentDate(appointment.appointmentDate) }
      : appointment;
    const [updatedAppointment] = await db.update(appointments).set(updateData).where(eq(appointments.id, id)).returning();
    return updatedAppointment;
  }

  private normalizeAppointmentDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setSeconds(0, 0);
    return normalized;
  }

  async getAppointmentsByDate(date: Date): Promise<Appointment[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.query.appointments.findMany({
      where: and(
        gte(appointments.appointmentDate, startOfDay),
        lte(appointments.appointmentDate, endOfDay)
      ),
      with: {
        patient: true,
        doctor: true
      },
      orderBy: appointments.appointmentDate
    });
  }

  async getAppointmentsByDoctor(doctorId: string, date?: Date): Promise<Appointment[]> {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      return await db.query.appointments.findMany({
        where: and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.appointmentDate, startOfDay),
          lte(appointments.appointmentDate, endOfDay)
        ),
        with: {
          patient: true,
          doctor: true
        },
        orderBy: appointments.appointmentDate
      });
    }
    
    return await db.query.appointments.findMany({
      where: eq(appointments.doctorId, doctorId),
      with: {
        patient: true,
        doctor: true
      },
      orderBy: appointments.appointmentDate
    });
  }

  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    return await db.query.appointments.findMany({
      where: eq(appointments.patientId, patientId),
      with: {
        patient: true,
        doctor: true
      },
      orderBy: desc(appointments.appointmentDate)
    });
  }

  async checkAppointmentConflict(doctorId: string, appointmentDate: Date, excludeId?: string): Promise<boolean> {
    // Normalize appointment date to ensure consistent comparisons
    // Strip seconds and milliseconds for exact 30-minute slot matching
    const slotStart = new Date(appointmentDate);
    slotStart.setSeconds(0, 0);
    
    console.log('🔍 Conflict Check Debug:', {
      originalDate: appointmentDate.toISOString(),
      slotStart: slotStart.toISOString(),
      doctorId,
      excludeId
    });
    
    // Validate that the time is on a 30-minute boundary
    const minutes = slotStart.getMinutes();
    if (minutes !== 0 && minutes !== 30) {
      throw new Error('Appointment time must be scheduled in 30-minute intervals');
    }
    
    // For conflict checking, we need to check if there's an appointment at the EXACT same slot time
    // We normalize both the input time and compare against normalized database times
    // This ensures we only block exact slot matches, not adjacent slots
    
    console.log('🕐 Checking for exact slot match at:', slotStart.toISOString());
    
    // Check for appointments at the exact same normalized time slot
    // We use a tight range check to handle minor timestamp differences (seconds/milliseconds)
    // but keep it precise to only match the same 30-minute slot
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + 29, 59, 999); // End at 29:59.999 to stay within the slot
    
    let whereConditions = and(
      eq(appointments.doctorId, doctorId),
      gte(appointments.appointmentDate, slotStart),
      lte(appointments.appointmentDate, slotEnd), // Use lte with proper drizzle function
      sql`${appointments.status} NOT IN ('cancelled')`
    );
    
    // If updating an existing appointment, exclude it from conflict check
    if (excludeId) {
      whereConditions = and(
        whereConditions,
        sql`${appointments.id} != ${excludeId}`
      );
    }
    
    const conflictingAppointments = await db.select().from(appointments)
      .where(whereConditions)
      .limit(1);
    
    console.log('🔍 Conflict Query Results:', {
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
      conflictCount: conflictingAppointments.length,
      conflicts: conflictingAppointments.map(apt => ({
        id: apt.id,
        appointmentDate: apt.appointmentDate.toISOString(),
        status: apt.status
      }))
    });
    
    return conflictingAppointments.length > 0;
  }

  async getAppointmentsBetweenDates(startDate: Date, endDate: Date): Promise<any[]> {
    return await db.select({
      id: appointments.id,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      appointmentDate: appointments.appointmentDate,
      status: appointments.status,
      appointmentType: appointments.appointmentType,
      notes: appointments.notes,
      patient: {
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        phone: patients.phone
      },
      doctor: {
        id: users.id,
        name: users.name
      }
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(users, eq(appointments.doctorId, users.id))
    .where(and(
      gte(appointments.appointmentDate, startDate),
      lte(appointments.appointmentDate, endDate)
    ))
    .orderBy(asc(appointments.appointmentDate));
  }

  async getAppointmentWithDetails(id: string): Promise<any | undefined> {
    const [appointment] = await db.select({
      id: appointments.id,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      appointmentDate: appointments.appointmentDate,
      status: appointments.status,
      appointmentType: appointments.appointmentType,
      notes: appointments.notes,
      patient: {
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        phone: patients.phone
      },
      doctor: {
        id: users.id,
        name: users.name
      }
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(users, eq(appointments.doctorId, users.id))
    .where(eq(appointments.id, id));
    return appointment || undefined;
  }

  async getAvailableAppointmentSlots(doctorId: string, date: Date): Promise<string[]> {
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0) {
      return [];
    }
    
    if (this.isSouthAfricanPublicHoliday(date)) {
      return [];
    }
    
    const slots: string[] = [];
    let startHour = 8;
    let endHour = 17;
    
    if (dayOfWeek === 6) {
      endHour = 13;
    }
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, minute, 0, 0);
        
        const hasConflict = await this.checkAppointmentConflict(doctorId, slotTime);
        if (!hasConflict) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          slots.push(timeString);
        }
      }
    }
    
    return slots;
  }

  private getSouthAfricanPublicHolidays(year: number): Date[] {
    const holidays = [
      new Date(year, 0, 1),
      new Date(year, 2, 21),
      new Date(year, 3, 27),
      new Date(year, 4, 1),
      new Date(year, 5, 16),
      new Date(year, 7, 9),
      new Date(year, 8, 24),
      new Date(year, 11, 16),
      new Date(year, 11, 25),
      new Date(year, 11, 26),
    ];
    
    const easterSunday = this.getEasterSunday(year);
    holidays.push(
      new Date(easterSunday.getTime() - 2 * 24 * 60 * 60 * 1000),
      new Date(easterSunday.getTime() + 1 * 24 * 60 * 60 * 1000)
    );
    
    return holidays;
  }

  private getEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  }

  private isSouthAfricanPublicHoliday(date: Date): boolean {
    const holidays = this.getSouthAfricanPublicHolidays(date.getFullYear());
    return holidays.some(holiday => 
      holiday.getFullYear() === date.getFullYear() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getDate() === date.getDate()
    );
  }

  async getAvailableAppointmentSlotsForAllDoctors(date: Date): Promise<Array<{doctorId: string, doctorName: string, availableSlots: string[]}>> {
    const doctors = await db.select().from(users).where(eq(users.role, 'doctor'));
    
    const results = [];
    
    for (const doctor of doctors) {
      const availableSlots = await this.getAvailableAppointmentSlots(doctor.id, date);
      results.push({
        doctorId: doctor.id,
        doctorName: doctor.name,
        availableSlots: availableSlots
      });
    }
    
    return results;
  }

  // Check-in methods
  async createCheckIn(insertCheckIn: InsertCheckIn): Promise<CheckIn> {
    const [checkIn] = await db.insert(checkIns).values(insertCheckIn).returning();
    return checkIn;
  }

  async getCheckInsByDate(date: Date): Promise<CheckIn[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select().from(checkIns)
      .where(and(
        gte(checkIns.checkInTime, startOfDay),
        lte(checkIns.checkInTime, endOfDay)
      ))
      .orderBy(desc(checkIns.checkInTime));
  }

  // Queue methods
  async getQueue(): Promise<Queue[]> {
    return await db.query.queue.findMany({
      where: sql`${queue.status} IN ('waiting', 'in_progress')`,
      with: {
        patient: true,
        doctor: true
      },
      orderBy: [queue.enteredAt, queue.priority]
    });
  }

  async addToQueue(insertQueue: InsertQueue): Promise<Queue> {
    const [queueItem] = await db.insert(queue).values(insertQueue).returning();
    return queueItem;
  }

  async updateQueueStatus(id: string, status: string, startedAt?: Date, completedAt?: Date): Promise<Queue> {
    const updateData: any = { status };
    if (startedAt) updateData.startedAt = startedAt;
    if (completedAt) updateData.completedAt = completedAt;
    
    const [updatedQueue] = await db.update(queue).set(updateData).where(eq(queue.id, id)).returning();
    return updatedQueue;
  }

  async removeFromQueue(id: string): Promise<void> {
    await db.delete(queue).where(eq(queue.id, id));
  }

  async getQueueByDoctor(doctorId: string): Promise<Queue[]> {
    return await db.query.queue.findMany({
      where: and(
        eq(queue.doctorId, doctorId),
        sql`${queue.status} IN ('waiting', 'in_progress')`
      ),
      with: {
        patient: true,
        doctor: true
      },
      orderBy: [queue.enteredAt, queue.priority]
    });
  }

  // Consultation methods
  async createConsultation(insertConsultation: InsertConsultation): Promise<Consultation> {
    const [consultation] = await db.insert(consultations).values(insertConsultation).returning();
    return consultation;
  }

  async getConsultation(id: string): Promise<Consultation | undefined> {
    const result = await db.select().from(consultations)
      .where(eq(consultations.id, id))
      .limit(1);
    return result[0];
  }

  async getConsultationsByPatient(patientId: string): Promise<Consultation[]> {
    return await db.select().from(consultations)
      .where(eq(consultations.patientId, patientId))
      .orderBy(desc(consultations.consultationDate));
  }

  async getConsultationsByDoctor(doctorId: string): Promise<Consultation[]> {
    return await db.select().from(consultations)
      .where(eq(consultations.doctorId, doctorId))
      .orderBy(desc(consultations.consultationDate));
  }

  // Payment methods
  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async getPaymentsByDate(date: Date): Promise<Payment[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select().from(payments)
      .where(and(
        gte(payments.paymentDate, startOfDay),
        lte(payments.paymentDate, endOfDay)
      ))
      .orderBy(desc(payments.paymentDate));
  }

  async getTotalRevenue(startDate: Date, endDate: Date): Promise<number> {
    const result = await db.select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(and(
        gte(payments.paymentDate, startDate),
        lte(payments.paymentDate, endDate)
      ));
    
    return result[0]?.total || 0;
  }

  // Activity log methods
  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLogs).values(insertLog).returning();
    return log;
  }

  async getActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }

  // Medical attachment methods
  async createMedicalAttachment(insertAttachment: InsertMedicalAttachment): Promise<MedicalAttachment> {
    const [attachment] = await db.insert(medicalAttachments).values(insertAttachment).returning();
    return attachment;
  }

  async getMedicalAttachmentsByConsultation(consultationId: string): Promise<MedicalAttachment[]> {
    return await db.query.medicalAttachments.findMany({
      where: eq(medicalAttachments.consultationId, consultationId),
      with: {
        uploadedByUser: {
          columns: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: desc(medicalAttachments.uploadedAt)
    });
  }

  async deleteMedicalAttachment(id: string): Promise<void> {
    await db.delete(medicalAttachments).where(eq(medicalAttachments.id, id));
  }

  async getMedicalAttachment(id: string): Promise<MedicalAttachment | undefined> {
    const [attachment] = await db.select().from(medicalAttachments).where(eq(medicalAttachments.id, id));
    return attachment || undefined;
  }

  async deleteMedicalAttachmentsByConsultation(consultationId: string): Promise<void> {
    // Get all attachments for this consultation first (to delete files from disk)
    const attachments = await this.getMedicalAttachmentsByConsultation(consultationId);
    
    // Delete files from disk
    const fs = require('fs');
    attachments.forEach(attachment => {
      if (fs.existsSync(attachment.filePath)) {
        try {
          fs.unlinkSync(attachment.filePath);
        } catch (error) {
          console.error(`Failed to delete file ${attachment.filePath}:`, error);
        }
      }
    });

    // Delete database records
    await db.delete(medicalAttachments).where(eq(medicalAttachments.consultationId, consultationId));
  }

  async deleteConsultation(id: string): Promise<void> {
    // First delete all associated medical attachments (cascade cleanup)
    await this.deleteMedicalAttachmentsByConsultation(id);
    
    // Then delete the consultation record
    await db.delete(consultations).where(eq(consultations.id, id));
  }

  // Medical aid claim methods
  async createMedicalAidClaim(insertClaim: InsertMedicalAidClaim): Promise<MedicalAidClaim> {
    const [claim] = await db.insert(medicalAidClaims).values(insertClaim).returning();
    return claim;
  }

  async getAllMedicalAidClaims(): Promise<MedicalAidClaim[]> {
    return await db.query.medicalAidClaims.findMany({
      with: {
        patient: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            medicalAidScheme: true,
            medicalAidNumber: true,
            phone: true
          }
        },
        checkIn: {
          columns: {
            id: true,
            checkInTime: true,
            paymentMethod: true
          }
        }
      },
      orderBy: desc(medicalAidClaims.createdAt)
    });
  }

  async updateMedicalAidClaim(id: string, claim: Partial<InsertMedicalAidClaim>): Promise<MedicalAidClaim> {
    const [updatedClaim] = await db.update(medicalAidClaims).set(claim).where(eq(medicalAidClaims.id, id)).returning();
    return updatedClaim;
  }

  // Dashboard stats
  async getDashboardStats(date: Date): Promise<{
    todayAppointments: number;
    queueCount: number;
    todayRevenue: number;
    newPatients: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Today's appointments
    const appointmentsResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(appointments)
      .where(and(
        gte(appointments.appointmentDate, startOfDay),
        lte(appointments.appointmentDate, endOfDay)
      ));

    // Queue count
    const queueResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(queue)
      .where(sql`${queue.status} IN ('waiting', 'in_progress')`);

    // Today's revenue
    const revenueResult = await db.select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(and(
        gte(payments.paymentDate, startOfDay),
        lte(payments.paymentDate, endOfDay)
      ));

    // New patients (this week)
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const newPatientsResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(patients)
      .where(gte(patients.createdAt, weekStart));

    return {
      todayAppointments: appointmentsResult[0]?.count || 0,
      queueCount: queueResult[0]?.count || 0,
      todayRevenue: revenueResult[0]?.total || 0,
      newPatients: newPatientsResult[0]?.count || 0,
    };
  }

  // Monthly comparison stats
  async getMonthlyStats(monthsBack: number = 12): Promise<{
    monthlyData: Array<{
      month: string;
      year: number;
      revenue: number;
      appointments: number;
      patients: number;
      completionRate: number;
    }>;
  }> {
    const monthlyData = [];
    const currentDate = new Date();

    for (let i = 0; i < monthsBack; i++) {
      const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      // Monthly revenue from payments
      const revenueResult = await db.select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
        .from(payments)
        .where(and(
          gte(payments.paymentDate, startOfMonth),
          lte(payments.paymentDate, endOfMonth)
        ));

      // Monthly appointments
      const appointmentsResult = await db.select({ 
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`SUM(CASE WHEN ${appointments.status} = 'completed' THEN 1 ELSE 0 END)`
      })
        .from(appointments)
        .where(and(
          gte(appointments.appointmentDate, startOfMonth),
          lte(appointments.appointmentDate, endOfMonth)
        ));

      // Monthly new patients
      const patientsResult = await db.select({ count: sql<number>`COUNT(*)` })
        .from(patients)
        .where(and(
          gte(patients.createdAt, startOfMonth),
          lte(patients.createdAt, endOfMonth)
        ));

      // Get approved medical aid claims for this month
      const approvedClaimsResult = await db.select({ 
        total: sql<number>`COALESCE(SUM(CAST(${medicalAidClaims.claimAmount} AS DECIMAL)), 0)`
      })
        .from(medicalAidClaims)
        .where(and(
          eq(medicalAidClaims.status, 'approved'),
          isNotNull(medicalAidClaims.claimAmount),
          gte(medicalAidClaims.approvedAt, startOfMonth),
          lte(medicalAidClaims.approvedAt, endOfMonth)
        ));

      const totalRevenue = (revenueResult[0]?.total || 0) + (approvedClaimsResult[0]?.total || 0);
      const totalAppointments = appointmentsResult[0]?.total || 0;
      const completedAppointments = appointmentsResult[0]?.completed || 0;
      const completionRate = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;

      monthlyData.push({
        month: targetDate.toLocaleDateString('en-US', { month: 'long' }),
        year: targetDate.getFullYear(),
        revenue: totalRevenue,
        appointments: totalAppointments,
        patients: patientsResult[0]?.count || 0,
        completionRate: completionRate
      });
    }

    return {
      monthlyData: monthlyData.reverse() // Reverse to show oldest to newest
    };
  }

  // Patient retention and trends analytics
  async getPatientRetentionStats(): Promise<{
    newVsReturning: {
      newPatients: number;
      returningPatients: number;
      totalPatients: number;
      newPatientRate: number;
      returningPatientRate: number;
    };
    registrationTrends: Array<{
      month: string;
      year: number;
      newRegistrations: number;
      returningPatients: number;
    }>;
    retentionRates: {
      thirtyDay: number;
      sixtyDay: number;
      ninetyDay: number;
    };
  }> {
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get all completed appointments to analyze patient behavior
    const allAppointments = await db.select({
      patientId: appointments.patientId,
      appointmentDate: appointments.appointmentDate
    })
      .from(appointments)
      .where(eq(appointments.status, 'completed'))
      .orderBy(appointments.appointmentDate);

    // Create map of patient first appointment dates
    const patientFirstVisit = new Map<string, Date>();
    allAppointments.forEach(apt => {
      if (!patientFirstVisit.has(apt.patientId) || apt.appointmentDate < patientFirstVisit.get(apt.patientId)!) {
        patientFirstVisit.set(apt.patientId, apt.appointmentDate);
      }
    });

    // Get appointments in current month
    const currentMonthAppointments = allAppointments.filter(apt => 
      apt.appointmentDate >= currentMonthStart && apt.appointmentDate <= currentMonthEnd
    );

    // Calculate new vs returning for current month
    const currentMonthPatients = new Set(currentMonthAppointments.map(apt => apt.patientId));
    let newPatients = 0;
    let returningPatients = 0;

    currentMonthPatients.forEach(patientId => {
      const firstVisit = patientFirstVisit.get(patientId);
      if (firstVisit && firstVisit >= currentMonthStart && firstVisit <= currentMonthEnd) {
        newPatients++;
      } else {
        returningPatients++;
      }
    });

    const totalPatients = newPatients + returningPatients;
    const newPatientRate = totalPatients > 0 ? Math.round((newPatients / totalPatients) * 100) : 0;
    const returningPatientRate = totalPatients > 0 ? Math.round((returningPatients / totalPatients) * 100) : 0;

    // Calculate registration trends for last 6 months
    const registrationTrends = [];
    
    // Get all patient registrations for the period
    const sixMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);
    const allPatientRegistrations = await db.select({
      id: patients.id,
      createdAt: patients.createdAt
    })
      .from(patients)
      .where(gte(patients.createdAt, sixMonthsAgo));

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      // New registrations in this month
      const newRegistrations = allPatientRegistrations.filter(p => 
        p.createdAt >= startOfMonth && p.createdAt <= endOfMonth
      ).length;

      // Returning patients (unique patients with appointments in this month who had first visit before this month)
      const monthAppointments = allAppointments.filter(apt => 
        apt.appointmentDate >= startOfMonth && apt.appointmentDate <= endOfMonth
      );
      
      const returningPatientsInMonth = new Set();
      monthAppointments.forEach(apt => {
        const firstVisit = patientFirstVisit.get(apt.patientId);
        if (firstVisit && firstVisit < startOfMonth) {
          returningPatientsInMonth.add(apt.patientId);
        }
      });

      registrationTrends.push({
        month: targetDate.toLocaleDateString('en-US', { month: 'long' }),
        year: targetDate.getFullYear(),
        newRegistrations,
        returningPatients: returningPatientsInMonth.size
      });
    }

    // Calculate cohort-based retention rates
    const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(currentDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(currentDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    // For retention rates, we need patients whose first visit was in each period
    // and check if they returned within the timeframe
    const calculateRetentionRate = (periodStart: Date): number => {
      const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days after period start
      
      // Find patients whose first visit was in this period
      const cohortPatients = Array.from(patientFirstVisit.entries()).filter(([_, firstVisit]) => 
        firstVisit >= periodStart && firstVisit < periodEnd
      );

      if (cohortPatients.length === 0) return 0;

      // Check how many returned after their first visit
      let retainedCount = 0;
      cohortPatients.forEach(([patientId, firstVisit]) => {
        const laterAppointments = allAppointments.filter(apt => 
          apt.patientId === patientId && apt.appointmentDate > firstVisit
        );
        if (laterAppointments.length > 0) {
          retainedCount++;
        }
      });

      return Math.round((retainedCount / cohortPatients.length) * 100);
    };

    const thirtyDayRate = calculateRetentionRate(thirtyDaysAgo);
    const sixtyDayRate = calculateRetentionRate(sixtyDaysAgo);
    const ninetyDayRate = calculateRetentionRate(ninetyDaysAgo);

    return {
      newVsReturning: {
        newPatients,
        returningPatients,
        totalPatients,
        newPatientRate,
        returningPatientRate
      },
      registrationTrends,
      retentionRates: {
        thirtyDay: thirtyDayRate,
        sixtyDay: sixtyDayRate,
        ninetyDay: ninetyDayRate
      }
    };
  }

  // Peak hours analysis
  async getPeakHoursAnalysis(): Promise<{
    hourlyDistribution: Array<{
      hour: number;
      count: number;
      percentage: number;
    }>;
    dailyDistribution: Array<{
      day: string;
      dayNumber: number;
      count: number;
      percentage: number;
    }>;
    peakHour: {
      hour: number;
      count: number;
      timeLabel: string;
    };
    peakDay: {
      day: string;
      count: number;
    };
  }> {
    // Get all completed appointments in the last 3 months for analysis
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const appointmentData = await db.select({
      appointmentDate: appointments.appointmentDate
    })
      .from(appointments)
      .where(and(
        sql`${appointments.status} IN ('completed', 'scheduled')`,
        gte(appointments.appointmentDate, threeMonthsAgo)
      ));

    // Initialize hourly distribution (0-23 hours)
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      percentage: 0
    }));

    // Initialize daily distribution (0=Sunday, 1=Monday, etc.)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyData = Array.from({ length: 7 }, (_, day) => ({
      day: dayNames[day],
      dayNumber: day,
      count: 0,
      percentage: 0
    }));

    const totalAppointments = appointmentData.length;

    // Process each appointment
    appointmentData.forEach((apt: { appointmentDate: Date }) => {
      const date = new Date(apt.appointmentDate);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      hourlyData[hour].count++;
      dailyData[dayOfWeek].count++;
    });

    // Calculate percentages
    hourlyData.forEach(hourData => {
      hourData.percentage = totalAppointments > 0 
        ? Math.round((hourData.count / totalAppointments) * 100) 
        : 0;
    });

    dailyData.forEach(dayData => {
      dayData.percentage = totalAppointments > 0 
        ? Math.round((dayData.count / totalAppointments) * 100) 
        : 0;
    });

    // Find peak hour
    const peakHourData = hourlyData.reduce((max, current) => 
      current.count > max.count ? current : max
    );

    // Format peak hour time label
    const formatHour = (hour: number): string => {
      if (hour === 0) return '12:00 AM';
      if (hour < 12) return `${hour}:00 AM`;
      if (hour === 12) return '12:00 PM';
      return `${hour - 12}:00 PM`;
    };

    const peakHour = {
      hour: peakHourData.hour,
      count: peakHourData.count,
      timeLabel: formatHour(peakHourData.hour)
    };

    // Find peak day
    const peakDayData = dailyData.reduce((max, current) => 
      current.count > max.count ? current : max
    );

    const peakDay = {
      day: peakDayData.day,
      count: peakDayData.count
    };

    return {
      hourlyDistribution: hourlyData,
      dailyDistribution: dailyData,
      peakHour,
      peakDay
    };
  }

  // Birthday wishes methods
  async createBirthdayWish(wish: InsertBirthdayWish): Promise<BirthdayWish> {
    const [result] = await db.insert(birthdayWishes).values(wish).returning();
    return result;
  }

  async getBirthdayWishesByDate(date: Date): Promise<BirthdayWish[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(birthdayWishes)
      .where(and(
        gte(birthdayWishes.sentAt, startOfDay),
        lte(birthdayWishes.sentAt, endOfDay)
      ))
      .orderBy(desc(birthdayWishes.sentAt));
  }

  async getTodaysBirthdayPatients(): Promise<Patient[]> {
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
    const todayDay = today.getDate();

    return await db
      .select()
      .from(patients)
      .where(
        sql`EXTRACT(MONTH FROM ${patients.dateOfBirth}) = ${todayMonth} AND EXTRACT(DAY FROM ${patients.dateOfBirth}) = ${todayDay}`
      );
  }

  async cleanupOldBirthdayWishes(): Promise<{ deletedCount: number }> {
    // Delete all birthday wishes that are older than today (previous days)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const result = await db
      .delete(birthdayWishes)
      .where(lt(birthdayWishes.sentAt, startOfToday));
    
    return { deletedCount: result.rowCount || 0 };
  }

  // Appointment reminder methods
  async insertAppointmentReminder(reminder: InsertAppointmentReminder): Promise<AppointmentReminder> {
    const [result] = await db.insert(appointmentReminders).values(reminder).returning();
    return result;
  }

  async getAppointmentReminderByAppointmentAndType(appointmentId: string, reminderType: 'weekly' | 'daily'): Promise<AppointmentReminder | undefined> {
    const [result] = await db
      .select()
      .from(appointmentReminders)
      .where(and(
        eq(appointmentReminders.appointmentId, appointmentId),
        eq(appointmentReminders.reminderType, reminderType)
      ));
    return result;
  }

  async updateAppointmentReminderResponse(requestId: string, response: string): Promise<void> {
    await db
      .update(appointmentReminders)
      .set({ webhookResponse: response })
      .where(eq(appointmentReminders.requestId, requestId));
  }

  async getAppointmentReminderStatuses(appointmentIds: string[]): Promise<{appointmentId: string, weeklyReminder?: AppointmentReminder, dailyReminder?: AppointmentReminder}[]> {
    if (appointmentIds.length === 0) return [];
    
    const reminders = await db
      .select()
      .from(appointmentReminders)
      .where(inArray(appointmentReminders.appointmentId, appointmentIds));
    
    // Group reminders by appointment ID and type
    const result = appointmentIds.map(appointmentId => {
      const weeklyReminder = reminders.find(r => r.appointmentId === appointmentId && r.reminderType === 'weekly');
      const dailyReminder = reminders.find(r => r.appointmentId === appointmentId && r.reminderType === 'daily');
      
      return {
        appointmentId,
        weeklyReminder,
        dailyReminder
      };
    });
    
    return result;
  }

  // API key methods
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [result] = await db.insert(apiKeys).values(apiKey).returning();
    return result;
  }

  async getApiKeysByUser(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [result] = await db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      ));
    return result;
  }

  async revokeApiKey(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, id));
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }
}

export const storage = new DatabaseStorage();
