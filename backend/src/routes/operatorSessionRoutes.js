'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { attachDeviceContext } = require('../middleware/deviceContext');
const operatorSessionController = require('../controllers/operatorSessionController');

// 1. Operator Sign-In on Cafe Device (Public/Device endpoint, validates PIN)
router.post('/signin', attachDeviceContext, operatorSessionController.signIn);

// 1b. Master Sign-In on Cafe Device (Canonical Master credentials, strictly single-cafe workspace)
router.post('/signin-master', attachDeviceContext, operatorSessionController.signInMaster);

// 2. Lock Active Session
router.post('/lock', authenticate, attachDeviceContext, operatorSessionController.lock);

// 3. Unlock Session (Requires PIN)
router.post('/unlock', attachDeviceContext, operatorSessionController.unlock);

// 4. Switch Operator
router.post('/switch', attachDeviceContext, operatorSessionController.switchOperator);

// 5. End Operator Session
router.post('/end', authenticate, attachDeviceContext, operatorSessionController.endSession);

// 6. Current Active Operator Session for Device
router.get('/current', attachDeviceContext, operatorSessionController.getCurrentSession);

// 7. List Operator Sessions (Audit / Governance)
router.get(
  '/sessions',
  authenticate,
  authorize('CAFE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  operatorSessionController.listSessions
);

// 8. Set / Reset Operator PIN
router.post(
  '/pin/set',
  authenticate,
  operatorSessionController.setPin
);

// 9. Acknowledge Handover Note
router.post(
  '/:operatorSessionId/handover/acknowledge',
  authenticate,
  operatorSessionController.acknowledgeHandover
);

module.exports = router;
