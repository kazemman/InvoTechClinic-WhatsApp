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
  insertBirthdayWishSchema, insertAppointmentReminderSchema, insertApiKeySchema,
  type User
} from "@shared/schema";
import { z } from "zod";
import { authenticateToken, requireRole, generateToken, hashPassword, verifyPassword, generateApiKey, hashApiKey, generateRegistrationToken, AuthenticatedRequest } from "./auth";

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
  app.get('/api/users', authenticateToken, requireRole(['staff', 'admin', 'doctor']), async (req, res) => {
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

  // Customer Relations routes - defined before :id route to avoid conflicts
  app.get('/api/patients/birthdays', authenticateToken, requireRole(['staff', 'admin']), async (req, res) => {
    try {
      const birthdayPatients = await storage.getTodaysBirthdayPatients();
      res.json(birthdayPatients);
    } catch (error) {
      console.error('Failed to fetch birthday patients:', error);
      res.status(500).json({ message: 'Failed to fetch birthday patients' });
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

  app.get('/api/appointments/available-slots', authenticateToken, async (req, res) => {
    try {
      const { doctorId, date } = req.query;
      
      if (!doctorId || !date) {
        return res.status(400).json({ 
          message: 'doctorId and date are required query parameters' 
        });
      }
      
      const appointmentDate = new Date(date as string);
      
      if (isNaN(appointmentDate.getTime())) {
        return res.status(400).json({ 
          message: 'Invalid date format. Please use ISO 8601 format (YYYY-MM-DD)' 
        });
      }
      
      const availableSlots = await storage.getAvailableAppointmentSlots(
        doctorId as string, 
        appointmentDate
      );
      
      res.json({
        date: appointmentDate.toISOString().split('T')[0],
        doctorId: doctorId,
        availableSlots: availableSlots,
        totalSlots: availableSlots.length
      });
    } catch (error) {
      console.error('Failed to fetch available slots:', error);
      res.status(500).json({ message: 'Failed to fetch available appointment slots' });
    }
  });

  app.get('/api/appointments/available-slots/all', authenticateToken, async (req, res) => {
    try {
      console.log('📍 /all endpoint called with query:', req.query);
      const { date } = req.query;
      
      if (!date) {
        console.log('❌ Missing date parameter');
        return res.status(400).json({ 
          message: 'date is required query parameter' 
        });
      }
      
      const appointmentDate = new Date(date as string);
      console.log('📅 Parsed date:', appointmentDate);
      
      if (isNaN(appointmentDate.getTime())) {
        console.log('❌ Invalid date format');
        return res.status(400).json({ 
          message: 'Invalid date format. Please use ISO 8601 format (YYYY-MM-DD)' 
        });
      }
      
      console.log('🔍 Fetching doctors with available slots...');
      const doctorsWithSlots = await storage.getAvailableAppointmentSlotsForAllDoctors(appointmentDate);
      console.log('✅ Doctors fetched:', doctorsWithSlots.length);
      
      const response = {
        date: appointmentDate.toISOString().split('T')[0],
        doctors: doctorsWithSlots.map(doc => ({
          doctorId: doc.doctorId,
          doctorName: doc.doctorName,
          availableSlots: doc.availableSlots,
          totalSlots: doc.availableSlots.length
        })),
        totalDoctors: doctorsWithSlots.length
      };
      
      console.log('📤 Sending response:', JSON.stringify(response).substring(0, 200));
      res.json(response);
    } catch (error: any) {
      console.error('💥 ERROR in /all endpoint:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ message: 'Failed to fetch available appointment slots for all doctors', error: error.message });
    }
  });

  // Appointment reminder routes
  app.get('/api/appointments/reminders/weekly', authenticateToken, requireRole(['admin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      // Get appointments scheduled for 7 days from now
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 7);
      targetDate.setHours(0, 0, 0, 0);

      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);

      const weeklyAppointments = await storage.getAppointmentsBetweenDates(targetDate, endDate);
      
      // Filter out appointments that already have weekly reminders sent
      // For now, we'll allow all appointments (no database tracking yet)
      const candidateAppointments = weeklyAppointments || [];
      
      res.json(candidateAppointments);
    } catch (error) {
      console.error('Failed to fetch weekly reminder candidates:', error);
      res.status(500).json({ message: 'Failed to fetch weekly reminder candidates' });
    }
  });

  app.get('/api/appointments/reminders/daily', authenticateToken, requireRole(['admin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      // Get appointments scheduled for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);

      const tomorrowAppointments = await storage.getAppointmentsBetweenDates(tomorrow, endOfTomorrow);
      
      // Filter out appointments that already have daily reminders sent
      // For now, we'll allow all appointments (no database tracking yet)
      const candidateAppointments = tomorrowAppointments || [];
      
      res.json(candidateAppointments);
    } catch (error) {
      console.error('Failed to fetch daily reminder candidates:', error);
      res.status(500).json({ message: 'Failed to fetch daily reminder candidates' });
    }
  });

  app.post('/api/appointments/reminders/weekly', authenticateToken, requireRole(['admin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      const { appointmentIds, customMessage } = req.body;
      
      if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
        return res.status(400).json({ message: 'appointmentIds array is required' });
      }

      const results = [];
      const timestamp = new Date().toISOString();

      console.log('Processing appointmentIds:', appointmentIds);
      
      for (const appointmentId of appointmentIds) {
        console.log('Processing appointment:', appointmentId);
        try {
          const appointment = await storage.getAppointmentWithDetails(appointmentId);
          console.log('Retrieved appointment:', appointment ? 'found' : 'not found');
          if (!appointment) {
            results.push({ appointmentId, success: false, error: 'Appointment not found' });
            continue;
          }

          // Check for existing successful reminder to prevent duplicates
          const existingReminder = await storage.getAppointmentReminderByAppointmentAndType(appointmentId, 'weekly');
          console.log('Existing reminder check:', existingReminder ? 'found' : 'none');
          if (existingReminder && existingReminder.webhookResponse) {
            console.log('Skipping - reminder already sent');
            results.push({ appointmentId, success: false, error: 'Weekly reminder already sent', skipped: true, patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}` });
            continue;
          }

          // Generate unique requestId for this appointment
          const requestId = `weekly_${appointmentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Format reminder message
          const appointmentDate = new Date(appointment.appointmentDate);
          const dayName = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });
          const timeStr = appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          
          // Use custom message if provided, otherwise use default
          let reminderMessage = customMessage || `Hello ${appointment.patient?.firstName} ${appointment.patient?.lastName}! ⏰ Friendly reminder: You have an upcoming appointment in one week on ${dayName} at ${timeStr} with Dr ${appointment.doctor?.name}. You can respond if you wish to reschedule.`;
          
          // Replace placeholders in custom message
          if (customMessage) {
            reminderMessage = customMessage
              .replace(/\[name and Lastname\]/g, `${appointment.patient?.firstName} ${appointment.patient?.lastName}`)
              .replace(/\[name\]/g, appointment.doctor?.name || 'Doctor')
              .replace(/Tuesday/g, dayName)
              .replace(/13:00/g, timeStr);
          }

          // Prepare clean webhook payload for n8n
          const webhookPayload = {
            patients: [
              {
                id: appointment.patient?.id,
                firstName: appointment.patient?.firstName,
                lastName: appointment.patient?.lastName,
                phoneNumber: appointment.patient?.phone,
                reminderMessage: reminderMessage,
                reminderType: "weekly",
                appointmentDate: appointment.appointmentDate
              }
            ],
            requestId: requestId,
            timestamp: timestamp,
            messageType: "weekly_reminder"
          };

          // Send to webhook
          if (process.env.N8N_BIRTHDAY_WEBHOOK_URL) {
            console.log('Sending webhook to:', process.env.N8N_BIRTHDAY_WEBHOOK_URL);
            console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));
            
            try {
              const response = await fetch(process.env.N8N_BIRTHDAY_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookPayload)
              });

              const responseText = await response.text();
              console.log('Webhook response status:', response.status, response.statusText);
              console.log('Webhook response body:', responseText);
              
              if (response.ok) {
                // Only create reminder record after successful send
                await storage.insertAppointmentReminder({
                  appointmentId,
                  patientId: appointment.patientId,
                  reminderType: 'weekly',
                  requestId,
                  webhookResponse: responseText,
                });
                results.push({ appointmentId, success: true, message: 'Weekly reminder sent', patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}` });
              } else {
                console.error('Webhook failed with status:', response.status, response.statusText);
                results.push({ appointmentId, success: false, error: `Webhook failed: ${response.status} ${response.statusText}`, patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}` });
              }
            } catch (fetchError: any) {
              console.error('Webhook fetch error:', fetchError);
              results.push({ appointmentId, success: false, error: `Webhook error: ${fetchError.message}`, patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}` });
            }
          } else {
            console.log('N8N_BIRTHDAY_WEBHOOK_URL not configured, skipping webhook send');
            results.push({ appointmentId, success: false, error: 'Webhook URL not configured' });
          }
        } catch (error: any) {
          results.push({ appointmentId, success: false, error: error.message });
        }
      }

      const successful = results.filter(r => r.success).length;
      res.json({
        message: `Sent ${successful} of ${appointmentIds.length} weekly reminders`,
        results,
        debug: {
          appointmentIds,
          webhookUrl: process.env.N8N_BIRTHDAY_WEBHOOK_URL ? 'configured' : 'missing',
          timestamp
        }
      });

    } catch (error: any) {
      console.error('Weekly reminder send error:', error);
      res.status(500).json({ message: 'Failed to send weekly reminders', error: error.message });
    }
  });

  app.post('/api/appointments/reminders/daily', authenticateToken, requireRole(['admin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      const { appointmentIds, customMessage } = req.body;
      
      if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
        return res.status(400).json({ message: 'appointmentIds array is required' });
      }

      const results = [];
      const timestamp = new Date().toISOString();

      for (const appointmentId of appointmentIds) {
        try {
          const appointment = await storage.getAppointmentWithDetails(appointmentId);
          if (!appointment) {
            results.push({ appointmentId, success: false, error: 'Appointment not found' });
            continue;
          }

          // Check for existing successful reminder to prevent duplicates
          const existingReminder = await storage.getAppointmentReminderByAppointmentAndType(appointmentId, 'daily');
          if (existingReminder && existingReminder.webhookResponse) {
            results.push({ appointmentId, success: false, error: 'Daily reminder already sent', skipped: true, patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}` });
            continue;
          }

          // Generate unique requestId for this appointment
          const requestId = `daily_${appointmentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Format reminder message  
          const appointmentDate = new Date(appointment.appointmentDate);
          const dayName = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });
          const timeStr = appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          
          // Use custom message if provided, otherwise use default
          let reminderMessage = customMessage || `Hello ${appointment.patient?.firstName} ${appointment.patient?.lastName}! ⏰ Reminder: You have an appointment tomorrow (${dayName}) at ${timeStr} with Dr ${appointment.doctor?.name}. Please arrive 15 minutes early.`;
          
          // Replace placeholders in custom message
          if (customMessage) {
            reminderMessage = customMessage
              .replace(/\[name and Last name\]/g, `${appointment.patient?.firstName} ${appointment.patient?.lastName}`)
              .replace(/\[time\]/g, timeStr)
              .replace(/\[name\]/g, appointment.doctor?.name || 'Doctor');
          }

          // Prepare clean webhook payload for n8n
          const webhookPayload = {
            patients: [
              {
                id: appointment.patient?.id,
                firstName: appointment.patient?.firstName,
                lastName: appointment.patient?.lastName,
                phoneNumber: appointment.patient?.phone,
                reminderMessage: reminderMessage,
                reminderType: "daily",
                appointmentDate: appointment.appointmentDate
              }
            ],
            requestId: requestId,
            timestamp: timestamp,
            messageType: "daily_reminder"
          };

          // Send to webhook
          if (process.env.N8N_BIRTHDAY_WEBHOOK_URL) {
            console.log('Sending webhook to:', process.env.N8N_BIRTHDAY_WEBHOOK_URL);
            console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));
            
            try {
              const response = await fetch(process.env.N8N_BIRTHDAY_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookPayload)
              });

              const responseText = await response.text();
              console.log('Webhook response status:', response.status, response.statusText);
              console.log('Webhook response body:', responseText);
              
              if (response.ok) {
                // Only create reminder record after successful send
                await storage.insertAppointmentReminder({
                  appointmentId,
                  patientId: appointment.patientId,
                  reminderType: 'daily',
                  requestId,
                  webhookResponse: responseText,
                });
                results.push({ appointmentId, success: true, message: 'Daily reminder sent', patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}` });
              } else {
                console.error('Webhook failed with status:', response.status, response.statusText);
                results.push({ appointmentId, success: false, error: `Webhook failed: ${response.status} ${response.statusText}`, patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}` });
              }
            } catch (fetchError: any) {
              console.error('Webhook fetch error:', fetchError);
              results.push({ appointmentId, success: false, error: `Webhook error: ${fetchError.message}`, patientName: `${appointment.patient?.firstName} ${appointment.patient?.lastName}` });
            }
          } else {
            console.log('N8N_BIRTHDAY_WEBHOOK_URL not configured, skipping webhook send');
            results.push({ appointmentId, success: false, error: 'Webhook URL not configured' });
          }
        } catch (error: any) {
          results.push({ appointmentId, success: false, error: error.message });
        }
      }

      const successful = results.filter(r => r.success).length;
      res.json({
        message: `Sent ${successful} of ${appointmentIds.length} daily reminders`,
        results
      });

    } catch (error: any) {
      console.error('Daily reminder send error:', error);
      res.status(500).json({ message: 'Failed to send daily reminders', error: error.message });
    }
  });

  // Get reminder statuses for appointments
  app.post('/api/appointments/reminders/statuses', authenticateToken, requireRole(['admin', 'staff']), async (req: AuthenticatedRequest, res) => {
    try {
      const { appointmentIds } = req.body;
      
      if (!appointmentIds || !Array.isArray(appointmentIds)) {
        return res.status(400).json({ message: 'appointmentIds array is required' });
      }
      
      const statuses = await storage.getAppointmentReminderStatuses(appointmentIds);
      res.json(statuses);
    } catch (error: any) {
      console.error('Failed to fetch reminder statuses:', error);
      res.status(500).json({ message: 'Failed to fetch reminder statuses', error: error.message });
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

      // Send to N8N birthday webhook
      const webhookUrl = process.env.N8N_BIRTHDAY_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({ message: 'Birthday webhook URL not configured' });
      }

      const webhookPayload = {
        patients: [
          {
            id: parseInt(patient.id) || patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            phoneNumber: patient.phone,
            birthdayMessage: message
          }
        ],
        requestId: `birthday_req_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`,
        timestamp: new Date().toISOString(),
        messageType: "birthday"
      };

      console.log('Sending birthday webhook POST to:', webhookUrl);
      console.log('Birthday webhook payload:', JSON.stringify(webhookPayload, null, 2));

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

  // Broadcast message endpoint
  app.post('/api/send-broadcast', authenticateToken, requireRole(['staff', 'admin']), async (req: AuthenticatedRequest, res) => {
    try {
      // Validate request body with Zod
      const bodySchema = z.object({
        message: z.string().min(1, 'Message is required')
      });
      
      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: validationResult.error.errors 
        });
      }

      const { message } = validationResult.data;

      // Get webhook URL
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(500).json({ message: 'Webhook URL not configured' });
      }

      // Generate unique requestId for this broadcast
      const requestId = `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Prepare clean webhook payload for n8n
      const webhookPayload = {
        message: message,
        requestId: requestId,
        timestamp: new Date().toISOString(),
        messageType: "broadcast"
      };

      try {
        // Build query parameters for POST request
        const params = new URLSearchParams({
          message: message,
          requestId: requestId,
          timestamp: new Date().toISOString(),
          messageType: "broadcast"
        });
        
        const postUrl = `${webhookUrl}?${params.toString()}`;
        console.log('Sending webhook POST to:', postUrl);
        
        const response = await fetch(postUrl, {
          method: 'POST',
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        const responseText = await response.text();
        console.log('Webhook response status:', response.status);
        console.log('Webhook response text:', responseText);

        // Log activity
        await storage.createActivityLog({
          userId: req.user!.id,
          action: 'send_broadcast',
          details: `Sent broadcast message: "${message}" - Status: ${response.status}`
        });

        res.status(response.ok ? 200 : 502).json({
          success: response.ok,
          message: response.ok ? 'Broadcast message sent successfully' : `Webhook failed with status ${response.status}`,
          statusCode: response.status,
          webhookResponse: responseText
        });

      } catch (error: any) {
        console.error('Failed to send broadcast message:', error);
        let errorMessage = 'Webhook error';
        if (error.name === 'AbortError') {
          errorMessage = 'Webhook timeout';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        res.status(504).json({ 
          success: false,
          message: 'Failed to send broadcast message to webhook',
          error: errorMessage
        });
      }

    } catch (error) {
      console.error('Failed to send broadcast:', error);
      res.status(500).json({ message: 'Failed to send broadcast message' });
    }
  });

  // Deprecated health advice endpoint
  app.post('/api/send-health-advice', authenticateToken, requireRole(['staff', 'admin']), async (req: AuthenticatedRequest, res) => {
    res.status(410).json({ 
      message: 'This endpoint is deprecated. Please use /api/send-broadcast instead.',
      deprecated: true 
    });
  });

  // Legacy health advice endpoint (to be removed)
  app.post('/api/send-health-advice-legacy', authenticateToken, requireRole(['staff', 'admin']), async (req: AuthenticatedRequest, res) => {
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
            patients: [
              {
                id: parseInt(patient.id) || patient.id,
                firstName: patient.firstName,
                lastName: patient.lastName,
                phoneNumber: patient.phone,
                message: finalMessage
              }
            ],
            requestId: `health_advice_req_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`,
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

  // PUBLIC API ENDPOINTS FOR N8N WHATSAPP WORKFLOW
  // These endpoints don't require authentication for external n8n access

  // Check if patient exists by phone number
  app.get('/api/public/patient/lookup/:phone', async (req, res) => {
    try {
      const { phone } = req.params;
      
      if (!phone || phone.length < 10) {
        return res.status(400).json({ 
          exists: false, 
          message: 'Valid phone number required' 
        });
      }

      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      
      const patient = await storage.getPatientByPhone(cleanPhone);
      
      if (patient) {
        res.json({
          exists: true,
          patientId: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: patient.phone
        });
      } else {
        res.json({
          exists: false,
          message: 'Patient not found'
        });
      }
    } catch (error: any) {
      console.error('Patient lookup error:', error);
      res.status(500).json({ 
        exists: false, 
        message: 'Error checking patient existence' 
      });
    }
  });

  // Generate registration link (protected - staff/admin only)
  app.post('/api/generate-registration-link', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { idPassport } = req.body;
      
      // Generate a secure random token
      const token = generateRegistrationToken();
      
      // Set expiration to 30 minutes from now
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      
      // Store the token in database with optional idPassport
      await storage.createRegistrationToken({
        token,
        idPassport: idPassport || null,
        expiresAt,
        usedAt: null
      });
      
      // Clean up old expired tokens (best-effort)
      storage.deleteExpiredRegistrationTokens().catch(err => 
        console.error('Failed to clean up expired tokens:', err)
      );
      
      // Get the base URL from environment or request
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : `${req.protocol}://${req.get('host')}`;
      
      const registrationUrl = `${baseUrl}/register?token=${token}`;
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user!.id,
        action: 'generate_registration_link',
        details: `Generated registration link${idPassport ? ` for ID/Passport: ${idPassport}` : ''} (expires in 30 minutes)`
      });
      
      res.json({
        success: true,
        token,
        url: registrationUrl,
        expiresAt: expiresAt.toISOString(),
        idPassport: idPassport || null
      });
    } catch (error) {
      console.error('Error generating registration link:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to generate registration link' 
      });
    }
  });

  // Validate registration token (public)
  app.get('/api/public/registration-token/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({
          valid: false,
          message: 'Token is required'
        });
      }
      
      const registrationToken = await storage.getRegistrationTokenByToken(token);
      
      if (!registrationToken) {
        return res.status(404).json({
          valid: false,
          message: 'Invalid registration link. Please request a new one.'
        });
      }
      
      if (registrationToken.usedAt) {
        return res.status(410).json({
          valid: false,
          message: 'This registration link has already been used.'
        });
      }
      
      if (new Date() > new Date(registrationToken.expiresAt)) {
        return res.status(410).json({
          valid: false,
          message: 'This registration link has expired. Please request a new one.'
        });
      }
      
      res.json({
        valid: true,
        expiresAt: registrationToken.expiresAt,
        idPassport: registrationToken.idPassport || null
      });
    } catch (error) {
      console.error('Error validating registration token:', error);
      res.status(500).json({
        valid: false,
        message: 'Failed to validate registration link'
      });
    }
  });

  // Public patient registration endpoint with photo upload
  app.post('/api/public/patient/register', upload.single('photo'), async (req, res) => {
    try {
      // When using FormData, all values come as strings, so we validate with string schema
      const bodySchema = z.object({
        token: z.string().min(1, 'Registration token is required'),
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
        phone: z.string().min(10, 'Valid phone number is required'),
        email: z.string().min(1, 'Email is required').email('Valid email is required'),
        dateOfBirth: z.string(),
        gender: z.string(),
        idNumber: z.string().min(1, 'ID number is required'),
        address: z.string().optional().or(z.literal("")),
        medicalAidScheme: z.string().optional().or(z.literal("")),
        medicalAidNumber: z.string().optional().or(z.literal("")),
        allergies: z.string().optional().or(z.literal(""))
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid patient data',
          errors: validationResult.error.errors
        });
      }

      const { token, gender, ...otherData } = validationResult.data;
      
      // Validate gender enum
      if (!['male', 'female', 'other'].includes(gender)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid gender value'
        });
      }
      
      const patientData = {
        ...otherData,
        gender: gender as 'male' | 'female' | 'other'
      };
      
      // Validate the registration token
      const registrationToken = await storage.getRegistrationTokenByToken(token);
      
      if (!registrationToken) {
        return res.status(404).json({
          success: false,
          message: 'Invalid registration link. Please request a new one.'
        });
      }
      
      if (registrationToken.usedAt) {
        return res.status(410).json({
          success: false,
          message: 'This registration link has already been used.'
        });
      }
      
      if (new Date() > new Date(registrationToken.expiresAt)) {
        return res.status(410).json({
          success: false,
          message: 'This registration link has expired. Please request a new one.'
        });
      }

      // Check if patient already exists by phone or ID number
      const existingPatient = await storage.getPatientByPhone(patientData.phone);
      if (existingPatient) {
        return res.status(409).json({
          success: false,
          message: 'Patient with this phone number already exists',
          patientId: existingPatient.id
        });
      }

      // Handle photo upload if provided
      let photoUrl: string | undefined = undefined;
      if (req.file) {
        photoUrl = `/uploads/patient-photos/${req.file.filename}`;
      }

      // Create new patient
      const newPatient = await storage.createPatient({
        ...patientData,
        dateOfBirth: new Date(patientData.dateOfBirth),
        photoUrl
      });
      
      // Mark the registration token as used
      await storage.markRegistrationTokenUsed(token);

      res.status(201).json({
        success: true,
        message: 'Patient registered successfully',
        patientId: newPatient.id,
        patient: {
          id: newPatient.id,
          firstName: newPatient.firstName,
          lastName: newPatient.lastName,
          phone: newPatient.phone,
          email: newPatient.email
        }
      });

    } catch (error: any) {
      console.error('Patient registration error:', error);
      
      if (error.message?.includes('unique constraint')) {
        return res.status(409).json({
          success: false,
          message: 'Patient with this ID number or phone already exists'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to register patient'
      });
    }
  });

  // Public appointment booking endpoint
  app.post('/api/public/appointment/book', async (req, res) => {
    try {
      const bodySchema = z.object({
        patientId: z.string().min(1, 'Patient ID is required'),
        doctorId: z.string().min(1, 'Doctor ID is required'),
        appointmentDate: z.string(),
        appointmentType: z.string().min(1, 'Appointment type is required'),
        notes: z.string().optional()
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid appointment data',
          errors: validationResult.error.errors
        });
      }

      const { patientId, doctorId, appointmentDate, appointmentType, notes } = validationResult.data;

      // Verify patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Verify doctor exists
      const doctor = await storage.getUser(doctorId);
      if (!doctor || doctor.role !== 'doctor') {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        });
      }

      // Create appointment
      const newAppointment = await storage.createAppointment({
        patientId,
        doctorId,
        appointmentDate: new Date(appointmentDate),
        appointmentType,
        notes: notes || '',
        status: 'scheduled'
      });

      res.status(201).json({
        success: true,
        message: 'Appointment booked successfully',
        appointmentId: newAppointment.id,
        appointment: {
          id: newAppointment.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          doctorName: doctor.name,
          appointmentDate: newAppointment.appointmentDate,
          appointmentType: newAppointment.appointmentType,
          status: newAppointment.status
        }
      });

    } catch (error: any) {
      console.error('Appointment booking error:', error);
      
      if (error.message?.includes('unique constraint')) {
        return res.status(409).json({
          success: false,
          message: 'Doctor is not available at this time slot'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to book appointment'
      });
    }
  });

  // Get available doctors for appointment booking
  app.get('/api/public/doctors', async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const availableDoctors = allUsers
        .filter((user: User) => user.role === 'doctor' && user.isActive)
        .map((doctor: User) => ({
          id: doctor.id,
          name: doctor.name,
          email: doctor.email
        }));

      res.json({
        success: true,
        doctors: availableDoctors
      });
    } catch (error: any) {
      console.error('Error fetching doctors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctors'
      });
    }
  });

  // API Key routes
  app.post('/api/api-keys', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
      
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);

      const newApiKey = await storage.createApiKey({
        userId: req.user.id,
        name,
        keyHash,
        isActive: true
      });

      await storage.createActivityLog({
        userId: req.user.id,
        action: 'create_api_key',
        details: `Created API key: ${name}`
      });

      const response = {
        id: newApiKey.id,
        name: newApiKey.name,
        key: apiKey,
        createdAt: newApiKey.createdAt
      };

      console.log('API Key created successfully:', { id: response.id, name: response.name, keyPreview: apiKey.substring(0, 10) + '...' });
      return res.status(200).json(response);
    } catch (error: any) {
      console.error('Error creating API key:', error);
      return res.status(500).json({ message: error.message || 'Failed to create API key' });
    }
  });

  app.get('/api/api-keys', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const apiKeys = await storage.getApiKeysByUser(req.user.id);
      
      res.json(apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        lastUsedAt: key.lastUsedAt,
        isActive: key.isActive,
        createdAt: key.createdAt
      })));
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ message: 'Failed to fetch API keys' });
    }
  });

  app.delete('/api/api-keys/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { id } = req.params;
      
      const apiKeys = await storage.getApiKeysByUser(req.user.id);
      const apiKey = apiKeys.find(key => key.id === id);
      
      if (!apiKey) {
        return res.status(404).json({ message: 'API key not found' });
      }

      await storage.revokeApiKey(id);

      await storage.createActivityLog({
        userId: req.user.id,
        action: 'revoke_api_key',
        details: `Revoked API key: ${apiKey.name}`
      });

      res.json({ message: 'API key revoked successfully' });
    } catch (error) {
      console.error('Error revoking API key:', error);
      res.status(500).json({ message: 'Failed to revoke API key' });
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
