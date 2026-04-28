const express = require('express');
const router  = express.Router();
const sessionController = require('../controllers/session.controller');

router.post('/get-session',          sessionController.getActiveSession);
router.post('/get-session-by-id',    sessionController.getSessionById);
router.post('/get-customer-sessions', sessionController.getCustomerSessions);
router.post('/validate-session',     sessionController.validateSession);
router.post('/start-session',        sessionController.startSession);
router.post('/get-chat-token',       sessionController.getChatToken);
router.post('/expire-old',           sessionController.expireOldSessions);
router.post('/create-manual',        sessionController.createManualSession); // Wallet flow

// HTTP Polling Chat
router.post('/messages',             sessionController.getChatMessages);
router.post('/send-message',         sessionController.sendChatMessage);

module.exports = router;
