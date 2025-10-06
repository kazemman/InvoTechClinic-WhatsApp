import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["staff", "admin", "doctor"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled"]);
export const queueStatusEnum = pgEnum("queue_status", ["waiting", "in_progress", "completed"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "medical_aid", "both"]);
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const medicalAidClaimStatusEnum = pgEnum("medical_aid_claim_status", ["pending", "submitted", "approved", "rejected"]);

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
  allergies: text("allergies"),
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
}, (table) => {
  return {
    // Unique constraint to prevent double-booking at database level
    uniqueSlot: uniqueIndex("unique_doctor_appointment_slot").on(table.doctorId, table.appointmentDate),
  };
});

export const checkIns = pgTable("check_ins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  appointmentId: varchar("appointment_id").references(() => appointments.id),
  checkInTime: timestamp("check_in_time").defaultNow().notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  isWalkIn: boolean("is_walk_in").default(false).notNull(),
  notes: text("notes"),
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
  queueId: varchar("queue_id").references(() => queue.id),
  notes: text("notes"),
  diagnosis: text("diagnosis"),
  prescription: text("prescription"),
  consultationDate: timestamp("consultation_date").defaultNow().notNull(),
});

export const medicalAttachments = pgTable("medical_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultationId: varchar("consultation_id").notNull().references(() => consultations.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
}, (table) => {
  return {
    // Index for performance when querying attachments by consultation
    consultationIdIdx: index("medical_attachments_consultation_id_idx").on(table.consultationId),
  };
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

export const medicalAidClaims = pgTable("medical_aid_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  checkInId: varchar("check_in_id").notNull().references(() => checkIns.id),
  status: medicalAidClaimStatusEnum("status").default("pending").notNull(),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  claimAmount: decimal("claim_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Unique constraint to ensure only one claim per check-in
    uniqueCheckIn: uniqueIndex("unique_medical_aid_claim_check_in").on(table.checkInId),
    // Index for performance when querying claims by patient
    patientIdIdx: index("medical_aid_claims_patient_id_idx").on(table.patientId),
  };
});

export const birthdayWishes = pgTable("birthday_wishes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  sentBy: varchar("sent_by").notNull().references(() => users.id),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  webhookResponse: text("webhook_response"),
}, (table) => {
  return {
    // Index for performance when querying by patient and date
    patientDateIdx: index("birthday_wishes_patient_date_idx").on(table.patientId, table.sentAt),
  };
});

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("api_keys_user_id_idx").on(table.userId),
  };
});

export const apptReminderTypeEnum = pgEnum("appt_reminder_type_enum", ["weekly", "daily"]);

export const appointmentReminders = pgTable("appointment_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id").notNull().references(() => appointments.id),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  reminderType: apptReminderTypeEnum("reminder_type").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  requestId: text("request_id").notNull(),
  webhookResponse: text("webhook_response"),
}, (table) => {
  return {
    // Unique constraint to prevent duplicate reminders for the same appointment and type
    uniqueReminder: uniqueIndex("unique_appointment_reminder").on(table.appointmentId, table.reminderType),
  };
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  appointments: many(appointments),
  queue: many(queue),
  consultations: many(consultations),
  activityLogs: many(activityLogs),
  birthdayWishes: many(birthdayWishes),
  apiKeys: many(apiKeys),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  checkIns: many(checkIns),
  queue: many(queue),
  consultations: many(consultations),
  payments: many(payments),
  medicalAidClaims: many(medicalAidClaims),
  birthdayWishes: many(birthdayWishes),
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
  medicalAidClaim: one(medicalAidClaims, {
    fields: [checkIns.id],
    references: [medicalAidClaims.checkInId],
  }),
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

export const consultationsRelations = relations(consultations, ({ one, many }) => ({
  patient: one(patients, {
    fields: [consultations.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [consultations.doctorId],
    references: [users.id],
  }),
  queue: one(queue, {
    fields: [consultations.queueId],
    references: [queue.id],
  }),
  medicalAttachments: many(medicalAttachments),
}));

export const medicalAttachmentsRelations = relations(medicalAttachments, ({ one }) => ({
  consultation: one(consultations, {
    fields: [medicalAttachments.consultationId],
    references: [consultations.id],
  }),
  uploadedByUser: one(users, {
    fields: [medicalAttachments.uploadedBy],
    references: [users.id],
  }),
}));

export const medicalAidClaimsRelations = relations(medicalAidClaims, ({ one }) => ({
  patient: one(patients, {
    fields: [medicalAidClaims.patientId],
    references: [patients.id],
  }),
  checkIn: one(checkIns, {
    fields: [medicalAidClaims.checkInId],
    references: [checkIns.id],
  }),
}));

export const birthdayWishesRelations = relations(birthdayWishes, ({ one }) => ({
  patient: one(patients, {
    fields: [birthdayWishes.patientId],
    references: [patients.id],
  }),
  sentByUser: one(users, {
    fields: [birthdayWishes.sentBy],
    references: [users.id],
  }),
}));

export const appointmentRemindersRelations = relations(appointmentReminders, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentReminders.appointmentId],
    references: [appointments.id],
  }),
  patient: one(patients, {
    fields: [appointmentReminders.patientId],
    references: [patients.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
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
}).extend({
  appointmentDate: z.coerce.date().transform(
    (date) => {
      // Normalize appointment date by zeroing seconds and milliseconds
      // This ensures consistent timestamps for conflict detection and database constraints
      const normalizedDate = new Date(date);
      normalizedDate.setSeconds(0, 0);
      return normalizedDate;
    }
  ).refine(
    (date) => {
      // Ensure appointment is scheduled in 30-minute intervals
      const minutes = date.getMinutes();
      return minutes === 0 || minutes === 30;
    },
    {
      message: "Appointment time must be scheduled in 30-minute intervals (e.g., 09:00, 09:30, 10:00)",
    }
  )
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
}).extend({
  amount: z.union([z.number(), z.string()]).transform((val) => {
    // Convert both numbers and strings to string format for database storage
    const numVal = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(numVal) || numVal <= 0) {
      throw new Error('Amount must be a positive number');
    }
    return numVal.toString();
  })
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export const insertMedicalAttachmentSchema = createInsertSchema(medicalAttachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertMedicalAidClaimSchema = createInsertSchema(medicalAidClaims).omit({
  id: true,
  createdAt: true,
});

export const updateMedicalAidClaimSchema = createInsertSchema(medicalAidClaims).pick({
  status: true,
  notes: true,
  submittedAt: true,
  approvedAt: true,
  claimAmount: true,
});

export const insertBirthdayWishSchema = createInsertSchema(birthdayWishes).omit({
  id: true,
  sentAt: true,
});

export const insertAppointmentReminderSchema = createInsertSchema(appointmentReminders).omit({
  id: true,
  sentAt: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
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
export type MedicalAttachment = typeof medicalAttachments.$inferSelect;
export type InsertMedicalAttachment = z.infer<typeof insertMedicalAttachmentSchema>;
export type MedicalAidClaim = typeof medicalAidClaims.$inferSelect;
export type InsertMedicalAidClaim = z.infer<typeof insertMedicalAidClaimSchema>;
export type BirthdayWish = typeof birthdayWishes.$inferSelect;
export type InsertBirthdayWish = z.infer<typeof insertBirthdayWishSchema>;
export type AppointmentReminder = typeof appointmentReminders.$inferSelect;
export type InsertAppointmentReminder = z.infer<typeof insertAppointmentReminderSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// Registration tokens table for secure time-limited patient registration links
export const registrationTokens = pgTable("registration_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRegistrationTokenSchema = createInsertSchema(registrationTokens).omit({
  id: true,
  createdAt: true,
});

export type RegistrationToken = typeof registrationTokens.$inferSelect;
export type InsertRegistrationToken = z.infer<typeof insertRegistrationTokenSchema>;

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
