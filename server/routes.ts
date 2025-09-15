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
  insertConsultationSchema, insertPaymentSchema, insertActivityLogSchema
} from "@shared/schema";
import { authenticateToken, requireRole, generateToken, hashPassword, verifyPassword, AuthenticatedRequest } from "./auth";

// Configure multer for file uploads
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
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
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
      const checkInData = insertCheckInSchema.parse(checkInBody);
      const checkIn = await storage.createCheckIn(checkInData);

      // Create payment record if payment amount is provided
      if (paymentAmount && paymentAmount > 0) {
        const paymentData = insertPaymentSchema.parse({
          patientId: checkIn.patientId,
          checkInId: checkIn.id,
          amount: paymentAmount,
          paymentMethod: checkIn.paymentMethod,
          status: 'completed'
        });
        await storage.createPayment(paymentData);
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
    } catch (error) {
      console.error('Check-in error:', error);
      res.status(400).json({ message: 'Failed to check in patient' });
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
  app.post('/api/consultations', authenticateToken, requireRole(['doctor']), async (req: AuthenticatedRequest, res) => {
    try {
      const consultationData = insertConsultationSchema.parse(req.body);
      const consultation = await storage.createConsultation(consultationData);

      // Update queue status to completed
      await storage.updateQueueStatus(consultation.queueId, 'completed', undefined, new Date());
      broadcastQueueUpdate();

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
