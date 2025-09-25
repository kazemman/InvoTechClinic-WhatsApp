import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import { storage } from "./storage";
import { 
  loginSchema, passwordResetSchema, insertUserSchema, insertPatientSchema, 
  insertAppointmentSchema, insertCheckInSchema, insertQueueSchema,
  insertConsultationSchema, insertPaymentSchema, insertActivityLogSchema,
  insertMedicalAttachmentSchema, insertMedicalAidClaimSchema, updateMedicalAidClaimSchema,
  insertBirthdayWishSchema
} from "@shared/schema";
import { z } from "zod";
import { authenticateToken, requireRole, generateToken, hashPassword, verifyPassword, AuthenticatedRequest } from "./auth";

// Configure multer for patient photo uploads
const upload = multer({
  dest: 'uploads/patient-photos/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Configure multer for medical file attachments
const medicalUpload = multer({
  dest: 'uploads/medical-attachments/',
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for medical files
  },
  fileFilter: (req, file, cb) => {
    // Allow common medical file types
    const allowedTypes = /pdf|doc|docx|txt|jpeg|jpg|png|gif|tiff|dcm|xml|json/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/tiff',
      'application/dicom', // DICOM medical imaging
      'application/xml',
      'text/xml',
      'application/json'
    ];
    const mimetypeAllowed = allowedMimeTypes.includes(file.mimetype);

    if (mimetypeAllowed && extname) {
      return cb(null, true);
    } else {
      cb(new Error('File type not supported. Supported types: PDF, DOC, DOCX, TXT, images (JPG, PNG, GIF, TIFF), DICOM, XML, JSON'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  // Broadcast queue updates to all connected clients
  function broadcastQueueUpdate() {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'queue_update' }));
      }
    });
  }

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'No account found with this email address' });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is disabled. Please contact an administrator' });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: 'Password is incorrect. Please check your password and try again' });
      }

      const token = generateToken(user.id);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        action: 'login',
        details: `User ${user.name} logged in`
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      res.status(400).json({ message: 'Invalid request data' });
    }
  });

  app.post('/api/auth/logout', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'logout',
          details: `User ${req.user.name} logged out`
        });
      }
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
    if (req.user) {
      res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role
      });
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  // User management routes
  app.get('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      })));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', authenticateToken, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await hashPassword(userData.passwordHash);
      
      const user = await storage.createUser({
        ...userData,
        passwordHash: hashedPassword
      });

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'create_user',
          details: `Created new user: ${user.name} (${user.role})`
        });
      }

      res.status(201).json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      });
    } catch (error) {
      res.status(400).json({ message: 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', authenticateToken, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const userData = req.body;
      
      if (userData.passwordHash) {
        userData.passwordHash = await hashPassword(userData.passwordHash);
      }

      const user = await storage.updateUser(id, userData);

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'update_user',
          details: `Updated user: ${user.name}`
        });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      });
    } catch (error) {
      res.status(400).json({ message: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', authenticateToken, requireRole(['admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'delete_user',
          details: `Deleted user with ID: ${id}`
        });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(400).json({ message: 'Failed to delete user' });
    }
  });

  // Patient routes
  app.get('/api/patients', authenticateToken, async (req, res) => {
    try {
      const patients = await storage.getAllPatients();
      res.json(patients);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch patients' });
    }
  });

  app.get('/api/patients/search', authenticateToken, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: 'Search query required' });
      }
      
      const patients = await storage.searchPatients(q);
      res.json(patients);
    } catch (error) {
      res.status(500).json({ message: 'Failed to search patients' });
    }
  });

  app.get('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const patient = await storage.getPatient(id);
      
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
      
      res.json(patient);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch patient' });
    }
  });

  app.post('/api/patients', authenticateToken, upload.single('photo'), async (req: AuthenticatedRequest, res) => {
    try {
      // Transform FormData fields for proper parsing
      const bodyData = { ...req.body };
      if (bodyData.dateOfBirth && typeof bodyData.dateOfBirth === 'string') {
        bodyData.dateOfBirth = new Date(bodyData.dateOfBirth);
      }
      
      const patientData = insertPatientSchema.parse(bodyData);
      
      if (req.file) {
        patientData.photoUrl = `/uploads/patient-photos/${req.file.filename}`;
      }

      const patient = await storage.createPatient(patientData);

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'create_patient',
          details: `Registered new patient: ${patient.firstName} ${patient.lastName}`
        });
      }

      res.status(201).json(patient);
    } catch (error: any) {
      console.error('Patient creation error:', error);
      
      // Handle specific database errors
      if (error.code === '23505' || error.message?.includes('unique')) {
        return res.status(409).json({ 
          message: 'This ID/Passport number is already registered. Please check the number and try again.' 
        });
      }
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid patient data provided.',
          errors: error.errors 
        });
      }
      
      res.status(400).json({ message: 'Failed to create patient' });
    }
  });

  app.put('/api/patients/:id', authenticateToken, upload.single('photo'), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      // Transform FormData fields for proper parsing (same as POST route)
      const bodyData = { ...req.body };
      if (bodyData.dateOfBirth && typeof bodyData.dateOfBirth === 'string') {
        bodyData.dateOfBirth = new Date(bodyData.dateOfBirth);
      }
      
      // Use a partial schema for updates (don't require all fields)
      const updateSchema = insertPatientSchema.partial();
      const patientData = updateSchema.parse(bodyData);
      
      if (req.file) {
        patientData.photoUrl = `/uploads/patient-photos/${req.file.filename}`;
      }

      console.log('Updating patient with ID:', id);
      console.log('Patient data to update:', JSON.stringify(patientData, null, 2));
      
      const patient = await storage.updatePatient(id, patientData);
      
      console.log('Updated patient result:', JSON.stringify(patient, null, 2));

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'update_patient',
          details: `Updated patient: ${patient.firstName} ${patient.lastName}`
        });
      }

      res.json(patient);
    } catch (error: any) {
      console.error('Patient update error:', error);
      
      // Handle specific database errors
      if (error.code === '23505' || error.message?.includes('unique')) {
        return res.status(409).json({ 
          message: 'This ID/Passport number is already registered. Please check the number and try again.' 
        });
      }
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid patient data provided.',
          errors: error.errors 
        });
      }
      
      res.status(400).json({ message: 'Failed to update patient' });
    }
  });

  // Appointment routes
  app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
      const { date, doctorId } = req.query;
      let appointments;

      if (date) {
        const appointmentDate = new Date(date as string);
        if (doctorId) {
          appointments = await storage.getAppointmentsByDoctor(doctorId as string, appointmentDate);
        } else {
          appointments = await storage.getAppointmentsByDate(appointmentDate);
        }
      } else if (doctorId) {
        appointments = await storage.getAppointmentsByDoctor(doctorId as string);
      } else {
        const today = new Date();
        appointments = await storage.getAppointmentsByDate(today);
      }

      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch appointments' });
    }
  });

  app.post('/api/appointments', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('Appointment creation request body:', JSON.stringify(req.body, null, 2));
      
      // Schema automatically normalizes dates via transform(), no manual conversion needed
      const appointmentData = insertAppointmentSchema.parse(req.body);
      console.log('Validated and normalized appointment data:', JSON.stringify(appointmentData, null, 2));
      
      // Check for appointment conflicts
      const hasConflict = await storage.checkAppointmentConflict(
        appointmentData.doctorId, 
        appointmentData.appointmentDate
      );
      
      if (hasConflict) {
        console.log('Appointment conflict detected for doctor:', appointmentData.doctorId, 'at time:', appointmentData.appointmentDate);
        return res.status(409).json({ 
          message: 'This doctor already has an appointment at the selected time. Please choose a different time slot.',
          conflict: true
        });
      }
      
      const appointment = await storage.createAppointment(appointmentData);
      console.log('Created appointment:', JSON.stringify(appointment, null, 2));

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'create_appointment',
          details: `Scheduled appointment for patient ID: ${appointment.patientId}`
        });
      }

      res.status(201).json(appointment);
    } catch (error: any) {
      console.error('Appointment creation error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        console.error('Zod validation errors:', error.errors);
        return res.status(400).json({ 
          message: 'Invalid appointment data provided.',
          errors: error.errors 
        });
      }
      
      // Handle database constraint errors (appointment slot conflicts)
      if (error.code === '23505' || error.message?.includes('unique')) {
        return res.status(409).json({ 
          message: 'This doctor already has an appointment at the selected time. Please choose a different time slot.',
          conflict: true
        });
      }
      
      // Handle other database errors
      if (error.code?.startsWith('23')) {
        return res.status(400).json({ 
          message: 'Database constraint violation.',
          details: error.message 
        });
      }
      
      res.status(400).json({ 
        message: 'Failed to create appointment',
        error: error.message 
      });
    }
  });

  app.put('/api/appointments/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      // Schema automatically normalizes dates via transform(), no manual conversion needed
      // Validate update data with partial schema
      const updateSchema = insertAppointmentSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
      // Fetch existing appointment to compute effective values
      const existingAppointment = await storage.getAppointment(id);
      if (!existingAppointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      
      // Compute effective doctorId and appointmentDate (updated value || existing value)
      const effectiveDoctorId = validatedData.doctorId || existingAppointment.doctorId;
      const effectiveAppointmentDate = validatedData.appointmentDate || existingAppointment.appointmentDate;
      
      // Always check for conflicts when either doctorId or appointmentDate could change
      if (validatedData.doctorId || validatedData.appointmentDate) {
        const hasConflict = await storage.checkAppointmentConflict(
          effectiveDoctorId, 
          effectiveAppointmentDate,
          id // Exclude current appointment from conflict check
        );
        
        if (hasConflict) {
          console.log('Appointment update conflict detected for doctor:', effectiveDoctorId, 'at time:', effectiveAppointmentDate);
          return res.status(409).json({ 
            message: 'This doctor already has another appointment at the selected time. Please choose a different time slot.',
            conflict: true
          });
        }
      }
      
      const appointment = await storage.updateAppointment(id, validatedData);

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'update_appointment',
          details: `Updated appointment ID: ${id}`
        });
      }

      res.json(appointment);
    } catch (error: any) {
      console.error('Appointment update error:', error);
      
      // Handle database constraint violations
      if (error.code === '23505' || error.message?.includes('unique')) {
        return res.status(409).json({ 
          message: 'This doctor already has an appointment at the selected time. Please choose a different time slot.',
          conflict: true
        });
      }
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid appointment data. Appointments must be scheduled in 30-minute slots.',
          errors: error.errors 
        });
      }
      
      res.status(400).json({ message: 'Failed to update appointment' });
    }
  });

  // Check-in routes
  app.post('/api/checkins', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { paymentAmount, doctorId, priority, ...checkInBody } = req.body;
      
      // Server-side validation for payment amount
      if (paymentAmount !== undefined) {
        if (typeof paymentAmount !== 'number' || isNaN(paymentAmount)) {
          return res.status(400).json({ message: 'Payment amount must be a valid number' });
        }
        if (paymentAmount <= 0) {
          return res.status(400).json({ message: 'Payment amount must be greater than 0' });
        }
      }

      // Validate payment method requirements
      const paymentMethod = checkInBody.paymentMethod;
      if ((paymentMethod === 'cash' || paymentMethod === 'both') && !paymentAmount) {
        return res.status(400).json({ message: 'Payment amount is required for cash payments' });
      }

      // Validate medical aid eligibility for medical aid payments
      if (paymentMethod === 'medical_aid' || paymentMethod === 'both') {
        const patient = await storage.getPatient(checkInBody.patientId);
        if (!patient || !patient.medicalAidScheme || !patient.medicalAidNumber) {
          return res.status(400).json({ 
            message: 'Selected patient is not eligible for medical aid payment. Patient must have medical aid details on file.' 
          });
        }
      }

      const checkInData = insertCheckInSchema.parse(checkInBody);
      const checkIn = await storage.createCheckIn(checkInData);

      // Create payment record if payment amount is provided
      if (paymentAmount && paymentAmount > 0) {
        const paymentData = insertPaymentSchema.parse({
          patientId: checkIn.patientId,
          checkInId: checkIn.id,
          amount: paymentAmount, // Schema handles coercion to string
          paymentMethod: checkIn.paymentMethod
        });
        await storage.createPayment(paymentData);
      }

      // Auto-create medical aid claim if payment method includes medical aid
      if (checkIn.paymentMethod === 'medical_aid' || checkIn.paymentMethod === 'both') {
        console.log('📋 Creating medical aid claim for payment method:', checkIn.paymentMethod);
        try {
          const medicalAidClaimData = {
            patientId: checkIn.patientId,
            checkInId: checkIn.id,
            status: 'pending' as const,
            notes: 'Auto-created claim from check-in process'
          };
          console.log('📋 Medical aid claim data:', medicalAidClaimData);
          const createdClaim = await storage.createMedicalAidClaim(medicalAidClaimData);
          console.log('✅ Successfully created medical aid claim:', createdClaim.id);
          
          // Log medical aid claim creation
          if (req.user) {
            await storage.createActivityLog({
              userId: req.user.id,
              action: 'create_medical_aid_claim',
              details: `Auto-created medical aid claim for patient ID: ${checkIn.patientId}`
            });
          }
        } catch (claimError: any) {
          // Log error but don't fail the entire check-in process
          console.error('❌ Failed to create medical aid claim:', claimError);
          console.error('❌ Error details:', claimError.message, claimError.stack);
          if (req.user) {
            await storage.createActivityLog({
              userId: req.user.id,
              action: 'medical_aid_claim_error',
              details: `Failed to auto-create medical aid claim for patient ID: ${checkIn.patientId}. Error: ${claimError.message}`
            });
          }
        }
      }

      // If there's an appointment, update its status to confirmed
      if (checkIn.appointmentId) {
        await storage.updateAppointment(checkIn.appointmentId, { status: 'confirmed' });
      }

      // Add to queue
      const queueData = insertQueueSchema.parse({
        patientId: checkIn.patientId,
        checkInId: checkIn.id,
        doctorId: doctorId,
        status: 'waiting',
        priority: priority || 0
      });

      await storage.addToQueue(queueData);
      broadcastQueueUpdate();

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'patient_checkin',
          details: `Patient checked in: ID ${checkIn.patientId}${paymentAmount ? ` with payment of R${paymentAmount}` : ''}`
        });
      }

      res.status(201).json(checkIn);
    } catch (error: any) {
      console.error('Check-in error:', error);
      
      // Handle specific validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid check-in data provided.',
          errors: error.errors 
        });
      }
      
      // Handle payment-related errors
      if (error.message?.includes('payment amount') || error.message?.includes('Payment amount')) {
        return res.status(400).json({ message: error.message });
      }
      
      // Handle medical aid eligibility errors
      if (error.message?.includes('medical aid') || error.message?.includes('eligible')) {
        return res.status(400).json({ message: error.message });
      }
      
      // Handle database constraint violations
      if (error.code === '23505' || error.message?.includes('unique')) {
        return res.status(409).json({ 
          message: 'This patient has already been checked in today.' 
        });
      }
      
      res.status(400).json({ message: 'Failed to check in patient' });
    }
  });

  // Check-in GET route
  app.get('/api/checkins', authenticateToken, async (req, res) => {
    try {
      const { date } = req.query;
      
      if (date && typeof date === 'string') {
        const checkInDate = new Date(date);
        const checkIns = await storage.getCheckInsByDate(checkInDate);
        res.json(checkIns);
      } else {
        // If no date provided, return empty array or all check-ins for today
        const today = new Date();
        const checkIns = await storage.getCheckInsByDate(today);
        res.json(checkIns);
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch check-ins' });
    }
  });

  // Queue routes
  app.get('/api/queue', authenticateToken, async (req, res) => {
    try {
      const { doctorId } = req.query;
      let queueItems;
      if (doctorId && typeof doctorId === 'string') {
        queueItems = await storage.getQueueByDoctor(doctorId);
      } else {
        queueItems = await storage.getQueue();
      }
      res.json(queueItems);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch queue' });
    }
  });

  app.put('/api/queue/:id/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const now = new Date();
      let startedAt, completedAt;
      
      if (status === 'in_progress') {
        startedAt = now;
      } else if (status === 'completed') {
        completedAt = now;
      }

      const queueItem = await storage.updateQueueStatus(id, status, startedAt, completedAt);
      broadcastQueueUpdate();

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'update_queue_status',
          details: `Updated queue status to ${status} for queue ID: ${id}`
        });
      }

      res.json(queueItem);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update queue status' });
    }
  });

  app.delete('/api/queue/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      await storage.removeFromQueue(id);
      broadcastQueueUpdate();

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'remove_from_queue',
          details: `Removed from queue: ID ${id}`
        });
      }

      res.json({ message: 'Removed from queue successfully' });
    } catch (error) {
      res.status(400).json({ message: 'Failed to remove from queue' });
    }
  });

  // Consultation routes
  app.post('/api/consultations', authenticateToken, requireRole(['doctor', 'admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const consultationData = insertConsultationSchema.parse(req.body);
      const consultation = await storage.createConsultation(consultationData);

      // Update queue status to completed only if queueId exists
      if (consultation.queueId && consultation.queueId.trim()) {
        await storage.updateQueueStatus(consultation.queueId, 'completed', undefined, new Date());
        broadcastQueueUpdate();
      }

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'create_consultation',
          details: `Completed consultation for patient ID: ${consultation.patientId}`
        });
      }

      res.status(201).json(consultation);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create consultation' });
    }
  });

  app.get('/api/consultations/patient/:patientId', authenticateToken, async (req, res) => {
    try {
      const { patientId } = req.params;
      const consultations = await storage.getConsultationsByPatient(patientId);
      res.json(consultations);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch consultations' });
    }
  });

  // Helper function to check if user has access to a consultation
  async function hasConsultationAccess(userId: string, consultationId: string, userRole: string): Promise<boolean> {
    if (userRole === 'admin') return true;
    
    const consultation = await storage.getConsultation(consultationId);
    if (!consultation) return false;
    
    // Doctors can access consultations they created
    if (userRole === 'doctor' && consultation.doctorId === userId) return true;
    
    return false;
  }

  // Medical attachment routes
  app.post('/api/medical-attachments', authenticateToken, medicalUpload.array('files', 5), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const { consultationId } = req.body;
      if (!consultationId) {
        return res.status(400).json({ message: 'Consultation ID is required' });
      }

      // Check if user has access to this consultation
      if (!req.user || !(await hasConsultationAccess(req.user.id, consultationId, req.user.role))) {
        return res.status(403).json({ message: 'Access denied: You do not have permission to upload files for this consultation' });
      }

      const attachments = [];

      for (const file of req.files) {
        const attachmentData = {
          consultationId,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedBy: req.user?.id || ''
        };

        const attachment = await storage.createMedicalAttachment(attachmentData);
        attachments.push(attachment);
      }

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'upload_medical_attachment',
          details: `Uploaded ${attachments.length} medical file(s) for consultation: ${consultationId}`
        });
      }

      res.status(201).json(attachments);
    } catch (error) {
      console.error('Medical attachment upload error:', error);
      res.status(400).json({ message: 'Failed to upload medical attachments' });
    }
  });

  app.get('/api/medical-attachments/:consultationId', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { consultationId } = req.params;
      
      // Check if user has access to this consultation
      if (!req.user || !(await hasConsultationAccess(req.user.id, consultationId, req.user.role))) {
        return res.status(403).json({ message: 'Access denied: You do not have permission to view attachments for this consultation' });
      }
      
      const attachments = await storage.getMedicalAttachmentsByConsultation(consultationId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch medical attachments' });
    }
  });

  app.get('/api/medical-attachments/file/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const attachment = await storage.getMedicalAttachment(id);
      
      if (!attachment) {
        return res.status(404).json({ message: 'Medical attachment not found' });
      }

      // Check if user has access to this consultation
      if (!req.user || !(await hasConsultationAccess(req.user.id, attachment.consultationId, req.user.role))) {
        return res.status(403).json({ message: 'Access denied: You do not have permission to download this file' });
      }

      // Set proper headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
      res.setHeader('Content-Type', attachment.mimeType);
      res.sendFile(path.resolve(attachment.filePath));
    } catch (error) {
      res.status(500).json({ message: 'Failed to download medical attachment' });
    }
  });

  app.delete('/api/medical-attachments/:id', authenticateToken, requireRole(['doctor', 'admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const attachment = await storage.getMedicalAttachment(id);
      
      if (!attachment) {
        return res.status(404).json({ message: 'Medical attachment not found' });
      }

      // Check if user has access to this consultation
      if (!req.user || !(await hasConsultationAccess(req.user.id, attachment.consultationId, req.user.role))) {
        return res.status(403).json({ message: 'Access denied: You do not have permission to delete this file' });
      }

      // Delete file from filesystem
      const fs = require('fs');
      if (fs.existsSync(attachment.filePath)) {
        fs.unlinkSync(attachment.filePath);
      }

      // Delete database record
      await storage.deleteMedicalAttachment(id);

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'delete_medical_attachment',
          details: `Deleted medical attachment: ${attachment.originalName}`
        });
      }

      res.json({ message: 'Medical attachment deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete medical attachment' });
    }
  });

  // Payment routes
  app.post('/api/payments', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'create_payment',
          details: `Processed payment: R${payment.amount} via ${payment.paymentMethod}`
        });
      }

      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ message: 'Failed to create payment' });
    }
  });

  app.get('/api/payments', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
    try {
      const { date } = req.query;
      const paymentDate = date ? new Date(date as string) : new Date();
      const payments = await storage.getPaymentsByDate(paymentDate);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch payments' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
      const today = new Date();
      const stats = await storage.getDashboardStats(today);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }
  });

  // Monthly comparison stats
  app.get('/api/dashboard/monthly-stats', authenticateToken, async (req, res) => {
    try {
      const monthsBack = req.query.months ? parseInt(req.query.months as string) : 12;
      const stats = await storage.getMonthlyStats(monthsBack);
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch monthly stats:', error);
      res.status(500).json({ message: 'Failed to fetch monthly stats' });
    }
  });

  // Patient retention analytics
  app.get('/api/dashboard/patient-retention', authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getPatientRetentionStats();
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch patient retention stats:', error);
      res.status(500).json({ message: 'Failed to fetch patient retention stats' });
    }
  });

  // Peak hours analysis
  app.get('/api/dashboard/peak-hours', authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getPeakHoursAnalysis();
      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch peak hours analysis:', error);
      res.status(500).json({ message: 'Failed to fetch peak hours analysis' });
    }
  });

  // Activity logs
  app.get('/api/activity-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
      const { limit } = req.query;
      const logs = await storage.getActivityLogs(limit ? parseInt(limit as string) : undefined);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
  });

  // Medical Aid Claims routes
  app.get('/api/medical-aid-claims', authenticateToken, requireRole(['staff', 'admin']), async (req, res) => {
    try {
      const claims = await storage.getAllMedicalAidClaims();
      res.json(claims);
    } catch (error) {
      console.error('Failed to fetch medical aid claims:', error);
      res.status(500).json({ message: 'Failed to fetch medical aid claims' });
    }
  });

  app.put('/api/medical-aid-claims/:id', authenticateToken, requireRole(['staff', 'admin']), async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      // Use restricted schema for updates - only allow updating safe fields
      const updateSchema = updateMedicalAidClaimSchema.partial().extend({
        // When setting status to 'submitted', automatically set submittedAt to current time
        // When setting status to 'approved', automatically set approvedAt to current time
        submittedAt: z.coerce.date().optional(),
        approvedAt: z.coerce.date().optional(),
      });
      
      let claimData = updateSchema.parse(req.body);
      
      // Auto-set timestamps based on status changes
      if (claimData.status === 'submitted' && !claimData.submittedAt) {
        claimData.submittedAt = new Date();
      }
      if (claimData.status === 'approved' && !claimData.approvedAt) {
        claimData.approvedAt = new Date();
      }
      
      const updatedClaim = await storage.updateMedicalAidClaim(id, claimData);

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'update_medical_aid_claim',
          details: `Updated medical aid claim status to: ${claimData.status || 'unknown'}`
        });
      }

      res.json(updatedClaim);
    } catch (error: any) {
      console.error('Medical aid claim update error:', error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid claim data provided.',
          errors: error.errors 
        });
      }
      
      res.status(400).json({ message: 'Failed to update medical aid claim' });
    }
  });

  // Customer Relations routes
  app.get('/api/patients/birthdays', authenticateToken, requireRole(['staff', 'admin']), async (req, res) => {
    try {
      const birthdayPatients = await storage.getTodaysBirthdayPatients();
      res.json(birthdayPatients);
    } catch (error) {
      console.error('Failed to fetch birthday patients:', error);
      res.status(500).json({ message: 'Failed to fetch birthday patients' });
    }
  });

  app.get('/api/birthday-wishes', authenticateToken, requireRole(['staff', 'admin']), async (req, res) => {
    try {
      const today = new Date();
      const birthdayWishes = await storage.getBirthdayWishesByDate(today);
      res.json(birthdayWishes);
    } catch (error) {
      console.error('Failed to fetch birthday wishes:', error);
      res.status(500).json({ message: 'Failed to fetch birthday wishes' });
    }
  });

  app.post('/api/send-birthday-wish', authenticateToken, requireRole(['staff', 'admin']), async (req: AuthenticatedRequest, res) => {
    try {
      // Validate request body with Zod
      const bodySchema = z.object({
        patientId: z.string().min(1, 'Patient ID is required'),
        customMessage: z.string().optional()
      });
      
      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: validationResult.error.errors 
        });
      }

      const { patientId, customMessage } = validationResult.data;

      // Get patient details
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Check for idempotency - prevent duplicate birthday wishes for same patient on same day
      const today = new Date();
      const existingWishes = await storage.getBirthdayWishesByDate(today);
      const alreadySent = existingWishes.some(wish => wish.patientId === patientId);
      
      if (alreadySent) {
        return res.status(409).json({ 
          message: 'Birthday wish already sent to this patient today' 
        });
      }

      // Generate birthday message
      const message = customMessage?.trim() || 
        `Happy Birthday ${patient.firstName}! 🎉 Wishing you a wonderful year ahead filled with health and happiness. From all of us at the clinic! 🎂`;

      // Send to N8N webhook
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({ message: 'Webhook URL not configured' });
      }

      const webhookPayload = {
        type: 'birthday_wish',
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: patient.phone,
          email: patient.email
        },
        message: message,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        console.error(`Webhook failed with status ${response.status}: ${response.statusText}`);
        return res.status(502).json({ 
          message: 'Failed to send message - webhook service unavailable' 
        });
      }

      const webhookResponse = await response.text();

      // Save birthday wish record
      await storage.createBirthdayWish({
        patientId: patient.id,
        sentBy: req.user!.id,
        message: message,
        webhookResponse: webhookResponse
      });

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'send_birthday_wish',
          details: `Sent birthday wish to ${patient.firstName} ${patient.lastName}`
        });
      }

      res.json({ 
        message: message, 
        success: true,
        webhookResponse: response.ok 
      });
    } catch (error: any) {
      console.error('Failed to send birthday wish:', error);
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        return res.status(504).json({ message: 'Request timeout - webhook service not responding' });
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Failed to send birthday wish' });
    }
  });

  app.post('/api/send-health-advice', authenticateToken, requireRole(['staff', 'admin']), async (req: AuthenticatedRequest, res) => {
    try {
      // Validate request body with Zod
      const bodySchema = z.object({
        adviceId: z.string().optional(),
        customMessage: z.string().optional(),
        patientIds: z.array(z.string().min(1)).min(1, 'At least one patient ID is required')
      }).refine(
        (data) => data.adviceId || data.customMessage,
        { message: 'Either adviceId or customMessage must be provided' }
      );
      
      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: validationResult.error.errors 
        });
      }

      const { adviceId, customMessage, patientIds } = validationResult.data;

      const predefinedAdvice = [
        {
          id: '1',
          title: 'Stay Hydrated',
          content: 'Remember to drink at least 8 glasses of water daily. Proper hydration is essential for your overall health and well-being.'
        },
        {
          id: '2', 
          title: 'Regular Exercise',
          content: 'Aim for at least 30 minutes of moderate exercise daily. Even a simple walk can make a significant difference to your health.'
        },
        {
          id: '3',
          title: 'Balanced Diet',
          content: 'Include plenty of fruits, vegetables, and whole grains in your diet. A balanced diet provides essential nutrients for optimal health.'
        },
        {
          id: '4',
          title: 'Regular Check-ups',
          content: 'Schedule regular medical check-ups to monitor your health and catch any potential issues early.'
        },
        {
          id: '5',
          title: 'Mental Health',
          content: 'Take time for mental health. Practice stress management techniques like meditation, deep breathing, or talking to someone you trust.'
        }
      ];

      let finalMessage = customMessage;
      if (adviceId) {
        const advice = predefinedAdvice.find(a => a.id === adviceId);
        if (advice) {
          finalMessage = `${advice.title}\n\n${advice.content}`;
        }
      }

      if (!finalMessage) {
        return res.status(400).json({ message: 'Unable to generate health advice message' });
      }

      // Get webhook URL
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({ message: 'Webhook URL not configured' });
      }

      let sentCount = 0;
      const results = [];

      // Send to each patient
      for (const patientId of patientIds) {
        try {
          const patient = await storage.getPatient(patientId);
          if (!patient) {
            results.push({ patientId, success: false, error: 'Patient not found' });
            continue;
          }

          const webhookPayload = {
            type: 'health_advice',
            patient: {
              id: patient.id,
              firstName: patient.firstName,
              lastName: patient.lastName,
              phone: patient.phone,
              email: patient.email
            },
            message: finalMessage,
            timestamp: new Date().toISOString()
          };

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          if (response.ok) {
            sentCount++;
            results.push({ patientId, success: true });
          } else {
            console.error(`Webhook failed for patient ${patientId}: ${response.status} ${response.statusText}`);
            results.push({ patientId, success: false, error: `Webhook failed: ${response.status}` });
          }
        } catch (error: any) {
          let errorMessage = 'Send failed';
          if (error.name === 'AbortError') {
            errorMessage = 'Timeout';
          } else if (error.message) {
            errorMessage = error.message;
          }
          results.push({ patientId, success: false, error: errorMessage });
        }
      }

      // Log activity
      if (req.user) {
        await storage.createActivityLog({
          userId: req.user.id,
          action: 'send_health_advice',
          details: `Sent health advice to ${sentCount} patients`
        });
      }

      res.json({ 
        sentCount,
        totalRequested: patientIds.length,
        results,
        message: finalMessage
      });
    } catch (error: any) {
      console.error('Failed to send health advice:', error);
      
      // Handle specific error types
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Failed to send health advice' });
    }
  });

  // Serve uploaded files
  // Static file serving for uploads with proper headers for inline viewing
  app.use('/uploads', express.static('uploads', {
    setHeaders: (res, path) => {
      if (path.includes('patient-photos')) {
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Type', 'image/jpeg');
      }
    }
  }));

  return httpServer;
}
