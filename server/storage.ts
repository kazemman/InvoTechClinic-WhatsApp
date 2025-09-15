import { 
  users, patients, appointments, checkIns, queue, consultations, payments, activityLogs,
  type User, type InsertUser, type Patient, type InsertPatient, 
  type Appointment, type InsertAppointment, type CheckIn, type InsertCheckIn,
  type Queue, type InsertQueue, type Consultation, type InsertConsultation,
  type Payment, type InsertPayment, type ActivityLog, type InsertActivityLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, ne } from "drizzle-orm";

export interface IStorage {
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
  checkAppointmentConflict(doctorId: string, appointmentDate: Date, excludeAppointmentId?: string): Promise<boolean>;

  // Transaction-based methods for race condition prevention
  createAppointmentSafely(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentSafely(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment>;

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
  createConsultation(consultation: InsertConsultation): Promise<Consultation>;
  getConsultationsByPatient(patientId: string): Promise<Consultation[]>;
  getConsultationsByDoctor(doctorId: string): Promise<Consultation[]>;

  // Payment methods
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByDate(date: Date): Promise<Payment[]>;
  getTotalRevenue(startDate: Date, endDate: Date): Promise<number>;

  // Activity log methods
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;

  // Dashboard stats
  getDashboardStats(date: Date): Promise<{
    todayAppointments: number;
    queueCount: number;
    todayRevenue: number;
    newPatients: number;
  }>;
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
    const [appointment] = await db.insert(appointments).values(insertAppointment).returning();
    return appointment;
  }

  async updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment> {
    const [updatedAppointment] = await db.update(appointments).set(appointment).where(eq(appointments.id, id)).returning();
    return updatedAppointment;
  }

  // Transaction-based methods for race condition prevention
  async createAppointmentSafely(insertAppointment: InsertAppointment): Promise<Appointment> {
    return await db.transaction(async (tx) => {
      // Normalize appointment time to 30-minute intervals
      const normalizedTime = new Date(insertAppointment.appointmentDate);
      const minutes = normalizedTime.getMinutes();
      if (minutes < 30) {
        normalizedTime.setMinutes(0, 0, 0);
      } else {
        normalizedTime.setMinutes(30, 0, 0);
      }

      // Check for conflicts within the transaction using FOR UPDATE to lock rows
      const conflictingAppointments = await tx.select().from(appointments)
        .where(and(
          eq(appointments.doctorId, insertAppointment.doctorId),
          eq(appointments.appointmentDate, normalizedTime),
          sql`${appointments.status} IN ('scheduled', 'confirmed', 'in_progress')`
        ))
        .for('update'); // Lock the rows to prevent concurrent modifications

      if (conflictingAppointments.length > 0) {
        throw new Error('APPOINTMENT_CONFLICT');
      }

      // Create the appointment with normalized time
      const appointmentData = { ...insertAppointment, appointmentDate: normalizedTime };
      const [appointment] = await tx.insert(appointments).values(appointmentData).returning();
      return appointment;
    });
  }

  async updateAppointmentSafely(id: string, appointmentUpdate: Partial<InsertAppointment>): Promise<Appointment> {
    return await db.transaction(async (tx) => {
      // Get current appointment with lock
      const [currentAppointment] = await tx.select().from(appointments)
        .where(eq(appointments.id, id))
        .for('update'); // Lock the appointment row

      if (!currentAppointment) {
        throw new Error('APPOINTMENT_NOT_FOUND');
      }

      // Determine effective doctor ID and appointment date
      const effectiveDoctorId = appointmentUpdate.doctorId || currentAppointment.doctorId;
      const effectiveAppointmentDate = appointmentUpdate.appointmentDate || currentAppointment.appointmentDate;

      // Normalize the effective appointment time
      const normalizedTime = new Date(effectiveAppointmentDate);
      const minutes = normalizedTime.getMinutes();
      if (minutes < 30) {
        normalizedTime.setMinutes(0, 0, 0);
      } else {
        normalizedTime.setMinutes(30, 0, 0);
      }

      // Check for conflicts, excluding current appointment
      const conflictingAppointments = await tx.select().from(appointments)
        .where(and(
          eq(appointments.doctorId, effectiveDoctorId),
          eq(appointments.appointmentDate, normalizedTime),
          ne(appointments.id, id),
          sql`${appointments.status} IN ('scheduled', 'confirmed', 'in_progress')`
        ))
        .for('update'); // Lock the conflicting rows

      if (conflictingAppointments.length > 0) {
        throw new Error('APPOINTMENT_CONFLICT');
      }

      // Apply time normalization to the update data if appointmentDate is being changed
      const finalUpdate = { ...appointmentUpdate };
      if (appointmentUpdate.appointmentDate) {
        finalUpdate.appointmentDate = normalizedTime;
      }

      // Update the appointment
      const [updatedAppointment] = await tx.update(appointments)
        .set(finalUpdate)
        .where(eq(appointments.id, id))
        .returning();

      return updatedAppointment;
    });
  }

  async getAppointmentsByDate(date: Date): Promise<Appointment[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select().from(appointments)
      .where(and(
        gte(appointments.appointmentDate, startOfDay),
        lte(appointments.appointmentDate, endOfDay)
      ))
      .orderBy(appointments.appointmentDate);
  }

  async getAppointmentsByDoctor(doctorId: string, date?: Date): Promise<Appointment[]> {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      return await db.select().from(appointments)
        .where(and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.appointmentDate, startOfDay),
          lte(appointments.appointmentDate, endOfDay)
        ))
        .orderBy(appointments.appointmentDate);
    }
    
    return await db.select().from(appointments)
      .where(eq(appointments.doctorId, doctorId))
      .orderBy(appointments.appointmentDate);
  }

  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    return await db.select().from(appointments)
      .where(eq(appointments.patientId, patientId))
      .orderBy(desc(appointments.appointmentDate));
  }

  async checkAppointmentConflict(doctorId: string, appointmentDate: Date, excludeAppointmentId?: string): Promise<boolean> {
    // Ensure appointment time is normalized to 30-minute intervals
    const normalizedTime = new Date(appointmentDate);
    const minutes = normalizedTime.getMinutes();
    if (minutes < 30) {
      normalizedTime.setMinutes(0, 0, 0);
    } else {
      normalizedTime.setMinutes(30, 0, 0);
    }

    // Since all appointment times are normalized to :00 or :30, 
    // we can check for exact equality on the normalized time
    let whereConditions = and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.appointmentDate, normalizedTime),
      sql`${appointments.status} IN ('scheduled', 'confirmed', 'in_progress')`
    );

    // Exclude specific appointment if provided (for updates)
    if (excludeAppointmentId) {
      whereConditions = and(
        whereConditions,
        ne(appointments.id, excludeAppointmentId)
      );
    }

    const conflictingAppointments = await db.select().from(appointments)
      .where(whereConditions)
      .limit(1);

    return conflictingAppointments.length > 0;
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
    return await db.select().from(queue)
      .where(sql`${queue.status} IN ('waiting', 'in_progress')`)
      .orderBy(queue.priority, queue.enteredAt);
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
    return await db.select().from(queue)
      .where(and(
        eq(queue.doctorId, doctorId),
        sql`${queue.status} IN ('waiting', 'in_progress')`
      ))
      .orderBy(queue.priority, queue.enteredAt);
  }

  // Consultation methods
  async createConsultation(insertConsultation: InsertConsultation): Promise<Consultation> {
    const [consultation] = await db.insert(consultations).values(insertConsultation).returning();
    return consultation;
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
}

export const storage = new DatabaseStorage();
