import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["staff", "admin", "doctor"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled"]);
export const queueStatusEnum = pgEnum("queue_status", ["waiting", "in_progress", "completed"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "medical_aid", "both"]);
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  dateOfBirth: timestamp("date_of_birth").notNull(),
  gender: genderEnum("gender").notNull(),
  idNumber: text("id_number").notNull().unique(),
  address: text("address"),
  medicalAidScheme: text("medical_aid_scheme"),
  medicalAidNumber: text("medical_aid_number"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  appointmentDate: timestamp("appointment_date").notNull(),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  appointmentType: text("appointment_type").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  appointmentId: varchar("appointment_id").references(() => appointments.id),
  checkInTime: timestamp("check_in_time").defaultNow().notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  isWalkIn: boolean("is_walk_in").default(false).notNull(),
});

export const queue = pgTable("queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  checkInId: varchar("check_in_id").notNull().references(() => checkIns.id),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  status: queueStatusEnum("status").default("waiting").notNull(),
  priority: integer("priority").default(0).notNull(),
  estimatedWaitTime: integer("estimated_wait_time"),
  actualWaitTime: integer("actual_wait_time"),
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const consultations = pgTable("consultations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  doctorId: varchar("doctor_id").notNull().references(() => users.id),
  queueId: varchar("queue_id").notNull().references(() => queue.id),
  notes: text("notes"),
  diagnosis: text("diagnosis"),
  prescription: text("prescription"),
  referralLetters: text("referral_letters"),
  attachments: text("attachments"),
  consultationDate: timestamp("consultation_date").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  checkInId: varchar("check_in_id").notNull().references(() => checkIns.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  appointments: many(appointments),
  queue: many(queue),
  consultations: many(consultations),
  activityLogs: many(activityLogs),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  checkIns: many(checkIns),
  queue: many(queue),
  consultations: many(consultations),
  payments: many(payments),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [appointments.doctorId],
    references: [users.id],
  }),
  checkIns: many(checkIns),
}));

export const checkInsRelations = relations(checkIns, ({ one, many }) => ({
  patient: one(patients, {
    fields: [checkIns.patientId],
    references: [patients.id],
  }),
  appointment: one(appointments, {
    fields: [checkIns.appointmentId],
    references: [appointments.id],
  }),
  queue: many(queue),
  payments: many(payments),
}));

export const queueRelations = relations(queue, ({ one }) => ({
  patient: one(patients, {
    fields: [queue.patientId],
    references: [patients.id],
  }),
  checkIn: one(checkIns, {
    fields: [queue.checkInId],
    references: [checkIns.id],
  }),
  doctor: one(users, {
    fields: [queue.doctorId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
});

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  checkInTime: true,
});

export const insertQueueSchema = createInsertSchema(queue).omit({
  id: true,
  enteredAt: true,
});

export const insertConsultationSchema = createInsertSchema(consultations).omit({
  id: true,
  consultationDate: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  paymentDate: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;
export type Queue = typeof queue.$inferSelect;
export type InsertQueue = z.infer<typeof insertQueueSchema>;
export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginSchema>;

// Password reset schema
export const passwordResetSchema = z.object({
  email: z.string().email(),
});

export type PasswordResetRequest = z.infer<typeof passwordResetSchema>;
